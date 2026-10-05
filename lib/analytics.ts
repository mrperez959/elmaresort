import "server-only";
import { query } from "./db";

const TYPES = new Set([
  "pageview",
  "engaged",
  "gallery_open",
  "photo_view",
  "gallery_time",
  "dates_selected",
  "checkout_start",
  "checkout_view",
  "signup",
  "booking",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const int = (v: unknown, max: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : null;
};

function device(ua: string): string {
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobi|iphone|android/i.test(ua)) return "mobile";
  return "desktop";
}

/** Store a batch of events from the browser. Location comes from Vercel's edge headers. */
export async function recordEvents(req: Request, body: Record<string, unknown>, userId: string | null) {
  const v = str(body.v, 36);
  const s = str(body.s, 36);
  if (!UUID.test(v) || !UUID.test(s)) return;
  const ctx = (body.ctx ?? {}) as Record<string, unknown>;
  const events = Array.isArray(body.events) ? body.events.slice(0, 20) : [];
  if (!events.length) return;

  const h = req.headers;
  const city = h.get("x-vercel-ip-city");
  await query(
    `INSERT INTO visits (id, visitor_id, country, region, city, device, referrer, utm_source, utm_medium, utm_campaign, landing, user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (id) DO UPDATE SET last_seen = now(), user_id = COALESCE(visits.user_id, EXCLUDED.user_id)`,
    [
      s,
      v,
      h.get("x-vercel-ip-country")?.slice(0, 2) ?? null,
      h.get("x-vercel-ip-country-region")?.slice(0, 8) ?? null,
      city ? decodeURIComponent(city).slice(0, 80) : null,
      device(h.get("user-agent") ?? ""),
      str(ctx.referrer, 120) || null,
      str(ctx.utm_source, 80).toLowerCase() || null,
      str(ctx.utm_medium, 80).toLowerCase() || null,
      str(ctx.utm_campaign, 120) || null,
      str(ctx.landing, 200) || null,
      userId,
    ],
  );

  for (const raw of events) {
    const e = (raw ?? {}) as Record<string, unknown>;
    const type = str(e.t, 20);
    if (!TYPES.has(type)) continue;
    const path = str(e.p, 200);
    if (path.startsWith("/admin")) continue;
    await query(
      "INSERT INTO visit_events (visit_id, type, path, n, ms, label) VALUES ($1,$2,$3,$4,$5,$6)",
      [s, type, path || null, int(e.n, 100_000_000), int(e.ms, 3_600_000), str(e.l, 40) || null],
    );
  }
}

/** Analytics older than ~13 months are deleted, occasionally. */
export async function pruneOld() {
  if (Math.random() < 0.01) await query("DELETE FROM visits WHERE last_seen < now() - interval '400 days'");
}
