import "server-only";

/** A blocked span from a calendar feed. `end` is exclusive (the check-out day). */
export type Busy = { start: string; end: string };

function toDate(value: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(value.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Minimal iCalendar (RFC 5545) reader: enough for Airbnb, Vrbo and Booking.com exports. */
export function parseIcs(text: string): Busy[] {
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const out: Busy[] = [];
  let inEvent = false;
  let start: string | null = null;
  let end: string | null = null;
  let cancelled = false;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      start = end = null;
      cancelled = false;
      continue;
    }
    if (line === "END:VEVENT") {
      if (inEvent && start && !cancelled) {
        const e = end && end > start ? end : nextDay(start);
        out.push({ start, end: e });
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const name = line.slice(0, colon).split(";")[0].toUpperCase();
    const value = line.slice(colon + 1);
    if (name === "DTSTART") start = toDate(value);
    else if (name === "DTEND") end = toDate(value);
    else if (name === "STATUS" && value.trim().toUpperCase() === "CANCELLED") cancelled = true;
  }
  return out;
}

type FeedResult = { url: string; fetchedAt: number; busy: Busy[] };

const shared = globalThis as unknown as { __elmaFeeds?: Map<string, FeedResult> };
const feeds = (shared.__elmaFeeds ??= new Map());

const FRESH_MS = 5 * 60_000; // normal page views
const STALE_OK_MS = 6 * 3_600_000; // show slightly old data if a feed is down
const BOOKING_STALE_OK_MS = 15 * 60_000; // but never take money on data older than this

export class FeedError extends Error {
  url: string;
  constructor(url: string, message: string) {
    super(message);
    this.url = url;
  }
}

export function feedLabel(url: string): string {
  try {
    const host = new URL(url).hostname;
    if (host.includes("airbnb")) return "Airbnb";
    if (host.includes("vrbo") || host.includes("homeaway")) return "Vrbo";
    if (host.includes("booking")) return "Booking.com";
    if (host.includes("hospitable")) return "Hospitable";
    return host;
  } catch {
    return "Calendar";
  }
}

async function download(url: string): Promise<Busy[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "ElmaResort-DirectBooking/1.0", Accept: "text/calendar" },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) throw new FeedError(url, `${feedLabel(url)} calendar answered HTTP ${res.status}.`);
  const text = await res.text();
  if (!text.includes("BEGIN:VCALENDAR")) {
    throw new FeedError(url, `${feedLabel(url)} link didn't return a calendar. Check that you copied the export (.ics) link.`);
  }
  return parseIcs(text);
}

/**
 * Busy spans from one feed. `forBooking` = we're about to take money: always
 * refetch, and only fall back to very recent data if the platform is down.
 */
export async function getFeed(url: string, { forBooking = false } = {}): Promise<FeedResult> {
  const hit = feeds.get(url);
  if (!forBooking && hit && Date.now() - hit.fetchedAt < FRESH_MS) return hit;
  try {
    const result = { url, fetchedAt: Date.now(), busy: await download(url) };
    feeds.set(url, result);
    return result;
  } catch (err) {
    const limit = forBooking ? BOOKING_STALE_OK_MS : STALE_OK_MS;
    if (hit && Date.now() - hit.fetchedAt < limit) {
      console.warn(`[ical] using cached ${feedLabel(url)} calendar:`, (err as Error).message);
      return hit;
    }
    if (err instanceof FeedError) throw err;
    throw new FeedError(url, `Couldn't download the ${feedLabel(url)} calendar: ${(err as Error).message}`);
  }
}

export function clearFeedCache() {
  feeds.clear();
}
