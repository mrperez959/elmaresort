import "server-only";
import { env } from "./env";
import { getDays, type Day } from "./hospitable";
import { isISODate, nightsBetween, nightsOf, todayAtProperty } from "./dates";
import type { Quote, StayRequest } from "./types";

export type QuoteErrorCode = "invalid" | "unavailable" | "min_stay" | "closed" | "guests" | "too_long";

export class QuoteError extends Error {
  code: QuoteErrorCode;
  constructor(code: QuoteErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function toCount(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

/** Validate untrusted input from the browser into a StayRequest. */
export function parseStayRequest(body: unknown): StayRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  const stay: StayRequest = {
    checkIn: String(b.checkIn ?? ""),
    checkOut: String(b.checkOut ?? ""),
    adults: toCount(b.adults, 0),
    children: toCount(b.children, 0),
    infants: toCount(b.infants, 0),
  };
  if (!isISODate(stay.checkIn) || !isISODate(stay.checkOut)) {
    throw new QuoteError("invalid", "Choose a check-in and a check-out date.");
  }
  return stay;
}

/** Pure pricing + rules check against calendar days that cover the stay. */
export function priceStay(stay: StayRequest, days: Day[]): Quote {
  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  if (stay.checkIn < todayAtProperty()) {
    throw new QuoteError("invalid", "Check-in can't be in the past.");
  }
  if (nights < 1) throw new QuoteError("invalid", "Check-out must be after check-in.");
  if (nights > env.maxNights()) {
    throw new QuoteError("too_long", `Stays booked online can be up to ${env.maxNights()} nights.`);
  }
  if (stay.adults < 1) throw new QuoteError("guests", "At least one adult is required.");
  if (stay.adults + stay.children > env.maxGuests()) {
    throw new QuoteError("guests", `The home sleeps up to ${env.maxGuests()} guests.`);
  }

  const byDate = new Map(days.map((d) => [d.date, d]));
  const first = byDate.get(stay.checkIn);
  if (!first) throw new QuoteError("unavailable", "Those dates aren't open for booking yet.");
  if (first.closedForCheckin) {
    throw new QuoteError("closed", "Check-in isn't available on that day. Try a different start date.");
  }
  if (nights < first.minStay) {
    throw new QuoteError("min_stay", `Stays starting that day need at least ${first.minStay} nights.`);
  }
  const last = byDate.get(stay.checkOut);
  if (last?.closedForCheckout) {
    throw new QuoteError("closed", "Check-out isn't available on that day. Try a different end date.");
  }

  let accommodation = 0;
  for (const date of nightsOf(stay.checkIn, stay.checkOut)) {
    const day = byDate.get(date);
    if (!day || !day.available) {
      throw new QuoteError("unavailable", "Some of those nights are already booked.");
    }
    if (!(day.price > 0)) {
      throw new QuoteError("unavailable", "Some of those nights don't have a price yet.");
    }
    accommodation += day.price;
  }

  const cleaningFee = env.cleaningFeeCents();
  const taxRatePercent = env.taxRatePercent();
  const tax = Math.round(((accommodation + cleaningFee) * taxRatePercent) / 100);

  return {
    ...stay,
    nights,
    currency: "USD",
    accommodation,
    cleaningFee,
    tax,
    taxRatePercent,
    total: accommodation + cleaningFee + tax,
  };
}

/** Fetch the calendar for the stay and price it. */
export async function quoteStay(stay: StayRequest, opts: { fresh?: boolean } = {}): Promise<Quote> {
  if (!isISODate(stay.checkIn) || !isISODate(stay.checkOut) || stay.checkOut <= stay.checkIn) {
    throw new QuoteError("invalid", "Check-out must be after check-in.");
  }
  // Refuse absurd ranges before calling the API.
  if (nightsBetween(stay.checkIn, stay.checkOut) > env.maxNights()) {
    throw new QuoteError("too_long", `Stays booked online can be up to ${env.maxNights()} nights.`);
  }
  // Include the check-out day so its closed-for-checkout flag can be read.
  const days = await getDays(stay.checkIn, stay.checkOut, opts);
  return priceStay(stay, days);
}
