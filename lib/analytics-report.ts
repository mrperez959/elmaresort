import "server-only";
import { query } from "./db";

export type Row = { key: string; label?: string; visits: number; bookings: number; revenue: number };

export type Report = {
  days: number;
  visitors: number;
  visits: number;
  pageviews: number;
  avgEngagedMs: number;
  bookings: number;
  revenue: number;
  daily: Array<{ day: string; visitors: number; bookings: number }>;
  funnel: Array<{ step: string; visits: number }>;
  gallery: { opened: number; avgMs: number; photos: Array<{ n: number; views: number; avgMs: number; totalMs: number }> };
  countries: Row[];
  states: Row[];
  sources: Array<Row & { campaign: string; medium: string }>;
  devices: Row[];
};

const RANGE = "v.first_seen >= now() - make_interval(days => $1)";

// Visits that ended in a booking, with the amount.
const BOOKED = `booked AS (
  SELECT e.visit_id, max(e.n) AS amount FROM visit_events e WHERE e.type = 'booking' GROUP BY e.visit_id
)`;

async function grouped(expr: string, days: number, where = "TRUE", limit = 20): Promise<Row[]> {
  // `expr` and `where` are fixed strings from this file, never user input.
  const rows = await query<{ key: string | null; visits: string; bookings: string; revenue: string | null }>(
    `WITH ${BOOKED}
     SELECT ${expr} AS key, count(*) AS visits, count(b.visit_id) AS bookings, coalesce(sum(b.amount), 0) AS revenue
     FROM visits v LEFT JOIN booked b ON b.visit_id = v.id
     WHERE ${RANGE} AND ${where}
     GROUP BY 1 ORDER BY count(*) DESC LIMIT ${limit}`,
    [days],
  );
  return rows.map((r) => ({
    key: r.key ?? "unknown",
    visits: Number(r.visits),
    bookings: Number(r.bookings),
    revenue: Number(r.revenue ?? 0),
  }));
}

export async function buildReport(days: number): Promise<Report> {
  const [summary] = await query<{ visits: string; visitors: string }>(
    `SELECT count(*) AS visits, count(DISTINCT visitor_id) AS visitors FROM visits v WHERE ${RANGE}`,
    [days],
  );
  const [events] = await query<{ pageviews: string; bookings: string; revenue: string | null }>(
    `SELECT count(*) FILTER (WHERE e.type = 'pageview') AS pageviews,
            count(DISTINCT e.visit_id) FILTER (WHERE e.type = 'booking') AS bookings,
            sum(e.n) FILTER (WHERE e.type = 'booking') AS revenue
     FROM visit_events e JOIN visits v ON v.id = e.visit_id WHERE ${RANGE}`,
    [days],
  );
  const [engaged] = await query<{ avg: string | null }>(
    `SELECT avg(t) AS avg FROM (
       SELECT e.visit_id, sum(e.ms) AS t FROM visit_events e JOIN visits v ON v.id = e.visit_id
       WHERE ${RANGE} AND e.type = 'engaged' GROUP BY e.visit_id) x`,
    [days],
  );
  const daily = await query<{ day: string; visitors: string; bookings: string }>(
    `WITH ${BOOKED}
     SELECT to_char(date_trunc('day', v.first_seen AT TIME ZONE 'America/New_York'), 'YYYY-MM-DD') AS day,
            count(DISTINCT v.visitor_id) AS visitors, count(b.visit_id) AS bookings
     FROM visits v LEFT JOIN booked b ON b.visit_id = v.id WHERE ${RANGE} GROUP BY 1 ORDER BY 1`,
    [days],
  );
  const steps = await query<{ type: string; visits: string }>(
    `SELECT e.type, count(DISTINCT e.visit_id) AS visits FROM visit_events e JOIN visits v ON v.id = e.visit_id
     WHERE ${RANGE} AND e.type IN ('gallery_open','dates_selected','checkout_start','checkout_view','signup','booking')
     GROUP BY e.type`,
    [days],
  );
  const stepCount = (t: string) => Number(steps.find((s) => s.type === t)?.visits ?? 0);
  const [gallery] = await query<{ avg: string | null }>(
    `SELECT avg(e.ms) AS avg FROM visit_events e JOIN visits v ON v.id = e.visit_id WHERE ${RANGE} AND e.type = 'gallery_time'`,
    [days],
  );
  const photos = await query<{ n: number; views: string; avg: string; total: string }>(
    `SELECT e.n, count(*) AS views, avg(e.ms) AS avg, sum(e.ms) AS total
     FROM visit_events e JOIN visits v ON v.id = e.visit_id
     WHERE ${RANGE} AND e.type = 'photo_view' AND e.n IS NOT NULL
     GROUP BY e.n ORDER BY sum(e.ms) DESC`,
    [days],
  );

  const visits = Number(summary.visits);
  const sources = await query<{ source: string; medium: string; campaign: string; visits: string; bookings: string; revenue: string | null }>(
    `WITH ${BOOKED}
     SELECT coalesce(v.utm_source, v.referrer, '(direct)') AS source, coalesce(v.utm_medium, '') AS medium,
            coalesce(v.utm_campaign, '') AS campaign,
            count(*) AS visits, count(b.visit_id) AS bookings, coalesce(sum(b.amount), 0) AS revenue
     FROM visits v LEFT JOIN booked b ON b.visit_id = v.id WHERE ${RANGE}
     GROUP BY 1, 2, 3 ORDER BY count(*) DESC LIMIT 30`,
    [days],
  );

  return {
    days,
    visitors: Number(summary.visitors),
    visits,
    pageviews: Number(events.pageviews),
    avgEngagedMs: Math.round(Number(engaged.avg ?? 0)),
    bookings: Number(events.bookings),
    revenue: Number(events.revenue ?? 0),
    daily: daily.map((d) => ({ day: d.day, visitors: Number(d.visitors), bookings: Number(d.bookings) })),
    funnel: [
      { step: "Visited the site", visits },
      { step: "Opened the photos", visits: stepCount("gallery_open") },
      { step: "Picked dates and saw the price", visits: stepCount("dates_selected") },
      { step: "Clicked Continue to checkout", visits: stepCount("checkout_start") },
      { step: "Created an account", visits: stepCount("signup") },
      { step: "Booked", visits: stepCount("booking") },
    ],
    gallery: {
      opened: stepCount("gallery_open"),
      avgMs: Math.round(Number(gallery.avg ?? 0)),
      photos: photos.map((p) => ({ n: p.n, views: Number(p.views), avgMs: Math.round(Number(p.avg)), totalMs: Number(p.total) })),
    },
    countries: await grouped("v.country", days),
    states: await grouped("v.region", days, "v.country = 'US'"),
    sources: sources.map((s) => ({
      key: s.source,
      medium: s.medium,
      campaign: s.campaign,
      visits: Number(s.visits),
      bookings: Number(s.bookings),
      revenue: Number(s.revenue ?? 0),
    })),
    devices: await grouped("v.device", days),
  };
}
