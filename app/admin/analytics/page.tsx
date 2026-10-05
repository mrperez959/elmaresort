import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isAdmin } from "@/lib/auth";
import { buildReport, type Row } from "@/lib/analytics-report";
import { PHOTOS } from "@/lib/property";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics", robots: { index: false, follow: false } };

const RANGES = [7, 30, 90, 365];

const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "Washington DC", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", PR: "Puerto Rico",
};

const countryName = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
};

const pct = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "–");

function duration(ms: number) {
  if (!ms) return "–";
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

function Table({ rows, name, total }: { rows: Row[]; name: (k: string) => string; total: number }) {
  if (!rows.length) return <p className="fine">No data yet.</p>;
  return (
    <div className="table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th></th>
            <th>Visits</th>
            <th>Share</th>
            <th>Bookings</th>
            <th>Conversion</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.key === "unknown" ? "Unknown" : name(r.key)}</td>
              <td>{r.visits}</td>
              <td>{pct(r.visits, total)}</td>
              <td>{r.bookings}</td>
              <td>{pct(r.bookings, r.visits)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  if (!(await isAdmin())) redirect("/admin");
  const { days: raw } = await searchParams;
  const days = RANGES.includes(Number(raw)) ? Number(raw) : 30;
  const r = await buildReport(days);
  const h = await headers();
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? h.get("host") ?? "your-site";
  const maxDaily = Math.max(1, ...r.daily.map((d) => d.visitors));

  return (
    <main className="page admin analytics">
      <div className="account-head">
        <h1 className="admin-title">Analytics</h1>
        <Link href="/admin" className="link">
          ← Back to settings
        </Link>
      </div>

      <nav className="range" aria-label="Date range">
        {RANGES.map((d) => (
          <Link key={d} href={`/admin/analytics?days=${d}`} aria-current={d === days ? "page" : undefined}>
            Last {d} days
          </Link>
        ))}
      </nav>

      <section className="kpis">
        <div>
          <span>Visitors</span>
          <strong>{r.visitors}</strong>
          <small>{r.visits} visits</small>
        </div>
        <div>
          <span>Pages viewed</span>
          <strong>{r.pageviews}</strong>
          <small>{r.visits ? (r.pageviews / r.visits).toFixed(1) : "–"} per visit</small>
        </div>
        <div>
          <span>Time on site</span>
          <strong>{duration(r.avgEngagedMs)}</strong>
          <small>average per visit</small>
        </div>
        <div>
          <span>Bookings</span>
          <strong>{r.bookings}</strong>
          <small>{money(r.revenue)}</small>
        </div>
        <div className="kpi-main">
          <span>Conversion rate</span>
          <strong>{pct(r.bookings, r.visits)}</strong>
          <small>of visits ended in a booking</small>
        </div>
      </section>

      <h2 className="admin-section">Visitors per day</h2>
      {r.daily.length ? (
        <div className="bars" role="img" aria-label="Visitors per day">
          {r.daily.map((d) => (
            <div key={d.day} className="bar" title={`${d.day}: ${d.visitors} visitors, ${d.bookings} bookings`}>
              <span style={{ height: `${(d.visitors / maxDaily) * 100}%` }} className={d.bookings ? "booked" : undefined} />
            </div>
          ))}
        </div>
      ) : (
        <p className="fine">No visits yet.</p>
      )}
      <p className="fine">Coral bars are days with a booking.</p>

      <h2 className="admin-section">Booking funnel</h2>
      <div className="funnel">
        {r.funnel.map((f) => (
          <div key={f.step} className="funnel-step">
            <div className="funnel-label">
              <span>{f.step}</span>
              <span>
                {f.visits} <small>({pct(f.visits, r.visits)})</small>
              </span>
            </div>
            <div className="funnel-track">
              <span style={{ width: r.visits ? `${(f.visits / r.visits) * 100}%` : 0 }} />
            </div>
          </div>
        ))}
      </div>

      <h2 className="admin-section">Photos</h2>
      <p>
        {pct(r.gallery.opened, r.visits)} of visits opened the photo viewer, and stayed {duration(r.gallery.avgMs)} on
        average.
      </p>
      {r.gallery.photos.length > 0 && (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Views</th>
                <th>Avg time</th>
                <th>Total time</th>
              </tr>
            </thead>
            <tbody>
              {r.gallery.photos.map((p) => {
                const photo = PHOTOS[p.n];
                return (
                  <tr key={p.n}>
                    <td className="photo-cell">
                      {photo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`${photo.src}-sm.webp`} alt="" width={64} height={44} />
                      )}
                      <span>{photo?.alt ?? `Photo ${p.n + 1}`}</span>
                    </td>
                    <td>{p.views}</td>
                    <td>{duration(p.avgMs)}</td>
                    <td>{duration(p.totalMs)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="two-col">
        <section>
          <h2 className="admin-section">Countries</h2>
          <Table rows={r.countries} name={countryName} total={r.visits} />
        </section>
        <section>
          <h2 className="admin-section">US states</h2>
          <Table rows={r.states} name={(k) => US_STATES[k] ?? k} total={r.countries.find((c) => c.key === "US")?.visits ?? 0} />
        </section>
      </div>

      <h2 className="admin-section">Where visitors came from</h2>
      {r.sources.length ? (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Campaign</th>
                <th>Visits</th>
                <th>Bookings</th>
                <th>Conversion</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {r.sources.map((s) => (
                <tr key={`${s.key}|${s.medium}|${s.campaign}`}>
                  <td>
                    {s.key}
                    {s.medium && <span className="fine"> / {s.medium}</span>}
                  </td>
                  <td>{s.campaign || "–"}</td>
                  <td>{s.visits}</td>
                  <td>{s.bookings}</td>
                  <td>{pct(s.bookings, s.visits)}</td>
                  <td>{money(s.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="fine">No data yet.</p>
      )}
      <div className="export-box utm">
        <strong>Tracking an ad campaign</strong>
        <p>Add these to the link you use in the ad, and its visits and bookings show up here on their own row:</p>
        <code>
          https://{host}/?utm_source=facebook&amp;utm_medium=paid&amp;utm_campaign=summer-2027
        </code>
        <p className="fine">
          utm_source = where the ad runs (facebook, instagram, google, tiktok, email). utm_campaign = your name for that
          campaign. Use a different campaign name for each ad you want to compare.
        </p>
      </div>

      <h2 className="admin-section">Devices</h2>
      <Table rows={r.devices} name={(k) => k.charAt(0).toUpperCase() + k.slice(1)} total={r.visits} />

      <p className="fine analytics-note">
        Visits by you while signed in to this admin panel aren&apos;t counted. Location comes from the visitor&apos;s
        internet connection (approximate; no IP addresses are stored). Data older than about 13 months is deleted.
      </p>
    </main>
  );
}
