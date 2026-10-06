// Smart pricing: nightly prices that follow the season, special dates and the
// booking calendar. Pure functions, used by the server for quotes and for the
// calendar, and by /admin for the preview.
import type { Settings, SmartPricing } from "./types";

const $ = (dollars: number) => dollars * 100;
const m = (weekday: number, weekend: number) => ({ weekday: $(weekday), weekend: $(weekend) });

/** Starting point from Tampa market data for 3-bedroom waterfront homes (Oct 2026). */
export const DEFAULT_SMART: SmartPricing = {
  enabled: true,
  months: [
    m(360, 475), // Jan: high season
    m(360, 475), // Feb
    m(370, 490), // Mar: spring break
    m(350, 460), // Apr
    m(305, 400), // May: medium
    m(305, 400), // Jun
    m(305, 400), // Jul: summer travel
    m(255, 335), // Aug: low (hurricane season)
    m(240, 320), // Sep
    m(255, 335), // Oct
    m(305, 400), // Nov: medium
    m(320, 420), // Dec (holidays are a special date)
  ],
  specials: [
    { start: "2026-11-25", end: "2026-11-29", label: "Thanksgiving", percent: 25 },
    { start: "2026-12-19", end: "2027-01-03", label: "Christmas & New Year", percent: 30 },
    { start: "2027-01-22", end: "2027-01-24", label: "Children's Gasparilla", percent: 15 },
    { start: "2027-01-29", end: "2027-01-31", label: "Gasparilla Pirate Fest", percent: 35 },
    { start: "2027-11-24", end: "2027-11-28", label: "Thanksgiving", percent: 25 },
    { start: "2027-12-18", end: "2028-01-02", label: "Christmas & New Year", percent: 30 },
  ],
  lastMinute: [
    { days: 3, percent: 15 },
    { days: 7, percent: 10 },
    { days: 14, percent: 5 },
  ],
  gapFill: { enabled: true, maxNights: 3, percent: 15 },
  demand: { enabled: true, threshold: 70, percent: 10 },
  minPrice: $(220),
  maxPrice: $(900),
};

export type NightReason = "season" | "weekend" | "special" | "demand" | "gap" | "lastMinute" | "floor" | "ceiling";

export type NightPrice = {
  date: string;
  price: number;
  /** before the gap / last-minute discount (for showing a crossed-out price) */
  regular: number;
  reasons: NightReason[];
  special?: string;
};

/** What the engine needs to know about each day: is the night free? */
export type DayState = { date: string; available: boolean };

const DAY = 86_400_000;
const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const weekdayOf = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const pct = (v: number, p: number) => Math.round((v * p) / 100);
/** Prices end in a round $5. */
const round5 = (cents: number) => Math.round(cents / 500) * 500;

/** Free runs of nights bounded by booked nights on both sides, keyed by date. */
function gapLengths(days: DayState[]): Map<string, number> {
  const gaps = new Map<string, number>();
  let i = 0;
  while (i < days.length) {
    if (days[i].available) {
      let j = i;
      while (j < days.length && days[j].available) j++;
      const boundedLeft = i > 0 && !days[i - 1].available;
      const boundedRight = j < days.length && !days[j].available;
      if (boundedLeft && boundedRight) for (let k = i; k < j; k++) gaps.set(days[k].date, j - i);
      i = j;
    } else i++;
  }
  return gaps;
}

/**
 * Price every date in `dates`. `days` must cover them plus some margin on
 * both sides (two weeks is plenty) so gaps and demand can be measured.
 */
export function priceNights(dates: string[], days: DayState[], s: Settings, today: string): NightPrice[] {
  const sp = s.smartPricing;
  if (!sp?.enabled) {
    const weekendRate = Math.round(s.baseNightly * (1 + s.weekendMarkupPercent / 100));
    return dates.map((date) => {
      const weekend = s.weekendNights.includes(weekdayOf(date));
      const price = weekend ? weekendRate : s.baseNightly;
      return { date, price, regular: price, reasons: weekend ? ["weekend"] : ["season"] };
    });
  }

  const byDate = new Map(days.map((d, i) => [d.date, i]));
  const gaps = sp.gapFill.enabled ? gapLengths(days) : new Map<string, number>();
  const todayT = toTime(today);

  return dates.map((date) => {
    const reasons: NightReason[] = [];
    const month = sp.months[Number(date.slice(5, 7)) - 1];
    const weekend = s.weekendNights.includes(weekdayOf(date));
    let price = weekend ? month.weekend : month.weekday;
    reasons.push(weekend ? "weekend" : "season");

    // Special dates (events, holidays): the biggest one that applies.
    const specials = sp.specials.filter((x) => date >= x.start && date < x.end);
    let special: string | undefined;
    if (specials.length) {
      const top = specials.reduce((a, b) => (Math.abs(b.percent) > Math.abs(a.percent) ? b : a));
      price += pct(price, top.percent);
      special = top.label;
      reasons.push("special");
    }

    // Demand: the two weeks around this night are already mostly booked.
    if (sp.demand.enabled) {
      const i = byDate.get(date);
      if (i !== undefined) {
        let known = 0;
        let booked = 0;
        for (let k = i - 7; k <= i + 7; k++) {
          if (k === i || k < 0 || k >= days.length) continue;
          if (toTime(days[k].date) < todayT) continue;
          known++;
          if (!days[k].available) booked++;
        }
        if (known >= 8 && (booked / known) * 100 >= sp.demand.threshold) {
          price += pct(price, sp.demand.percent);
          reasons.push("demand");
        }
      }
    }

    const regular = round5(Math.min(sp.maxPrice, Math.max(sp.minPrice, price)));

    // Discounts to fill empty nights. They don't stack: the biggest one wins.
    let discount = 0;
    let why: NightReason | null = null;
    const gap = gaps.get(date);
    if (gap !== undefined && gap <= sp.gapFill.maxNights) {
      discount = sp.gapFill.percent;
      why = "gap";
    }
    const daysAway = Math.round((toTime(date) - todayT) / DAY);
    const tier = [...sp.lastMinute].sort((a, b) => a.days - b.days).find((t) => daysAway <= t.days);
    if (tier && daysAway >= 0 && tier.percent > discount) {
      discount = tier.percent;
      why = "lastMinute";
    }
    if (why) {
      price -= pct(price, discount);
      reasons.push(why);
    }

    if (price < sp.minPrice) reasons.push("floor");
    if (price > sp.maxPrice) reasons.push("ceiling");
    price = round5(Math.min(sp.maxPrice, Math.max(sp.minPrice, price)));
    return { date, price, regular: Math.max(regular, price), reasons, special };
  });
}

/** For gap-fill: free runs shorter than the minimum stay can be booked exactly. */
export function gapMinStays(days: DayState[], s: Settings): Map<string, number> {
  const out = new Map<string, number>();
  const sp = s.smartPricing;
  if (!sp?.enabled || !sp.gapFill.enabled) return out;
  for (const [date, len] of gapLengths(days)) {
    if (len < s.minNights && len <= sp.gapFill.maxNights) out.set(date, len);
  }
  return out;
}
