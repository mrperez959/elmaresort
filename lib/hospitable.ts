import "server-only";
import { HospitableClient } from "hospitable";
import { env } from "./env";
import { addDays } from "./dates";

export type Day = {
  date: string;
  available: boolean;
  /** Nightly price in cents, as set in Hospitable */
  price: number;
  minStay: number;
  closedForCheckin: boolean;
  closedForCheckout: boolean;
};

let client: HospitableClient | null = null;

export function hospitable(): HospitableClient {
  if (!client) client = new HospitableClient({ token: env.hospitableToken() });
  return client;
}

// Short in-memory cache so page visits don't hammer the API. Anything that
// takes money (quote for checkout, finalizing) asks for fresh data instead.
const CACHE_MS = 60_000;
const shared = globalThis as unknown as { __elmaCalendar?: Map<string, { at: number; days: Day[] }> };
const cache = (shared.__elmaCalendar ??= new Map());

export function clearCalendarCache() {
  cache.clear();
}

async function fetchChunk(start: string, end: string): Promise<Day[]> {
  const cal = await hospitable().calendar.get(env.propertyId(), start, end);
  return cal.days.map((d) => ({
    date: d.date.slice(0, 10),
    available: Boolean(d.status?.available),
    price: d.price?.amount ?? 0,
    minStay: d.minStay && d.minStay > 0 ? d.minStay : 1,
    closedForCheckin: Boolean(d.closedForCheckin),
    closedForCheckout: Boolean(d.closedForCheckout),
  }));
}

/**
 * Calendar days from `start` to `end` inclusive. Long ranges are split into
 * 90-day chunks to stay well inside any per-request limit.
 */
export async function getDays(
  start: string,
  end: string,
  { fresh = false }: { fresh?: boolean } = {},
): Promise<Day[]> {
  const key = `${start}:${end}`;
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.days;

  const chunks: Array<[string, string]> = [];
  for (let s = start; s <= end; s = addDays(s, 90)) {
    const e = addDays(s, 89);
    chunks.push([s, e < end ? e : end]);
  }
  const results = await Promise.all(chunks.map(([s, e]) => fetchChunk(s, e)));
  const days = results.flat().sort((a, b) => a.date.localeCompare(b.date));

  cache.set(key, { at: Date.now(), days });
  return days;
}
