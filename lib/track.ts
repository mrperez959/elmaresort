// Browser-side tracker: tiny, no cookies, no third parties.
// Events are batched and sent with sendBeacon so they survive page closes.

export type TrackType =
  | "pageview"
  | "engaged" // ms the page was visible
  | "gallery_open"
  | "photo_view" // n = photo index, ms = time on it
  | "gallery_time" // ms the photo viewer was open
  | "dates_selected"
  | "checkout_start"
  | "checkout_view"
  | "signup"
  | "booking"; // label = code, n = total cents

type Event = { t: TrackType; p?: string; n?: number; ms?: number; l?: string };

const VISITOR_KEY = "er_vid";
const SESSION_KEY = "er_sid";
const IDLE_MS = 30 * 60_000;

let queue: Event[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function uuid(): string {
  return crypto.randomUUID();
}

function storage(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Visitor = this browser (kept). Visit = this browsing session (30 min idle ends it). */
function ids(): { v: string; s: string; isNew: boolean } {
  const ls = storage("local");
  const ss = storage("session");
  let v = ls?.getItem(VISITOR_KEY) ?? "";
  if (!v) {
    v = uuid();
    ls?.setItem(VISITOR_KEY, v);
  }
  const raw = ss?.getItem(SESSION_KEY);
  const [sid, last] = raw ? raw.split("|") : ["", "0"];
  const fresh = !sid || Date.now() - Number(last) > IDLE_MS;
  const s = fresh ? uuid() : sid;
  ss?.setItem(SESSION_KEY, `${s}|${Date.now()}`);
  return { v, s, isNew: fresh };
}

function context(): Record<string, string> {
  const url = new URL(window.location.href);
  const ref = document.referrer ? new URL(document.referrer) : null;
  // A Google Ads click carries ?gclid=… : count it as google / cpc when the ad has no UTM tags.
  const fromAds = url.searchParams.has("gclid") || url.searchParams.has("gbraid") || url.searchParams.has("wbraid");
  return {
    landing: url.pathname,
    referrer: ref && ref.host !== url.host ? ref.host : "",
    utm_source: url.searchParams.get("utm_source") ?? (fromAds ? "google" : ""),
    utm_medium: url.searchParams.get("utm_medium") ?? (fromAds ? "cpc" : ""),
    utm_campaign: url.searchParams.get("utm_campaign") ?? "",
  };
}

// ---------- Google Ads conversions ----------

type Gtag = (...args: unknown[]) => void;

const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? "";
const ADS_LABELS: Partial<Record<TrackType, string>> = {
  booking: process.env.NEXT_PUBLIC_GOOGLE_ADS_BOOKING_LABEL ?? "",
  checkout_start: process.env.NEXT_PUBLIC_GOOGLE_ADS_CHECKOUT_LABEL ?? "",
};

/** Report a conversion to Google Ads (booking: with its real amount, de-duplicated by code). */
function adsConversion(t: TrackType, data: Omit<Event, "t">) {
  const label = ADS_LABELS[t];
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (!ADS_ID || !label || !gtag) return;
  gtag("event", "conversion", {
    send_to: `${ADS_ID}/${label}`,
    ...(t === "booking"
      ? { value: (data.n ?? 0) / 100, currency: "USD", transaction_id: data.l ?? "" }
      : {}),
  });
}

let pendingContext: Record<string, string> | null = null;

function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!queue.length) return;
  const { v, s, isNew } = ids();
  if (isNew || pendingContext === null) pendingContext = context();
  const body = JSON.stringify({ v, s, ctx: pendingContext, events: queue.splice(0, 20) });
  const blob = new Blob([body], { type: "application/json" });
  if (!navigator.sendBeacon?.("/api/t", blob)) {
    fetch("/api/t", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(
      () => undefined,
    );
  }
  if (queue.length) flush();
}

export function track(t: TrackType, data: Omit<Event, "t"> = {}) {
  if (typeof window === "undefined") return;
  if (/bot|crawl|spider|headless|lighthouse/i.test(navigator.userAgent)) return;
  queue.push({ t, p: window.location.pathname, ...data });
  adsConversion(t, data);
  if (!timer) timer = setTimeout(flush, 1500);
}

export function flushNow() {
  flush();
}
