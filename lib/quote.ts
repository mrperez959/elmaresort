import "server-only";
import { getDays, type Day, type Replacing } from "./availability";
import { getSettings } from "./settings";
import { isISODate, nightsBetween, nightsOf, todayAtProperty } from "./dates";
import { isWeekendNight, weekendRate } from "./pricing";
import type { AppliedPromo, Quote, Settings, StayRequest } from "./types";
import { validatePromo, PromoError, normalizeCode } from "./promos";

export type QuoteErrorCode =
  | "invalid"
  | "unavailable"
  | "min_stay"
  | "closed"
  | "guests"
  | "too_long"
  | "not_ready"
  | "promo";

export class QuoteError extends Error {
  code: QuoteErrorCode;
  constructor(code: QuoteErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function toCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 100 ? n : 0;
}

/** Validate untrusted input from the browser into a StayRequest. */
export function parseStayRequest(body: unknown): StayRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  const stay: StayRequest = {
    checkIn: String(b.checkIn ?? ""),
    checkOut: String(b.checkOut ?? ""),
    adults: toCount(b.adults),
    children: toCount(b.children),
    infants: toCount(b.infants),
    pets: toCount(b.pets),
    promo: typeof b.promo === "string" && b.promo.trim() ? normalizeCode(b.promo).slice(0, 24) : undefined,
  };
  if (!isISODate(stay.checkIn) || !isISODate(stay.checkOut)) {
    throw new QuoteError("invalid", "Choose a check-in and a check-out date.");
  }
  return stay;
}

const pct = (amount: number, percent: number) => Math.round((amount * percent) / 100);

/**
 * Pricing + rules check. Pure: availability comes from `days` (Hospitable),
 * prices and policies from `s` (the admin settings).
 */
export function priceStay(
  stay: StayRequest,
  days: Day[],
  s: Settings,
  today: string,
  promo: AppliedPromo | null = null,
): Quote {
  if (s.taxes === null) {
    throw new QuoteError("not_ready", "Online booking isn't open yet. Please check back soon.");
  }
  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  if (stay.checkIn < today) throw new QuoteError("invalid", "Check-in can't be in the past.");
  if (nights < 1) throw new QuoteError("invalid", "Check-out must be after check-in.");
  if (nights > s.maxNights) {
    throw new QuoteError("too_long", `Stays booked online can be up to ${s.maxNights} nights.`);
  }
  if (stay.adults < 1) throw new QuoteError("guests", "At least one adult is required.");
  if (stay.adults + stay.children > s.maxGuests) {
    throw new QuoteError("guests", `The home sleeps up to ${s.maxGuests} guests.`);
  }
  if (stay.pets > s.maxPets) {
    throw new QuoteError(
      "guests",
      s.maxPets === 0 ? "Pets aren't allowed." : `Up to ${s.maxPets} ${s.maxPets === 1 ? "pet is" : "pets are"} allowed.`,
    );
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
  if (byDate.get(stay.checkOut)?.closedForCheckout) {
    throw new QuoteError("closed", "Check-out isn't available on that day. Try a different end date.");
  }

  const wkRate = weekendRate(s);
  let weekendNights = 0;
  for (const date of nightsOf(stay.checkIn, stay.checkOut)) {
    if (!byDate.get(date)?.available) {
      throw new QuoteError("unavailable", "Some of those nights are already booked.");
    }
    if (isWeekendNight(date, s)) weekendNights++;
  }
  const weekdayNights = nights - weekendNights;
  const nightsSubtotal = weekdayNights * s.baseNightly + weekendNights * wkRate;

  // Longest-stay discount wins; they don't stack with each other.
  let lengthDiscount: Quote["lengthDiscount"] = null;
  if (s.monthlyDiscountPercent > 0 && nights >= s.monthlyMinNights) {
    lengthDiscount = {
      label: "Monthly discount",
      percent: s.monthlyDiscountPercent,
      amount: pct(nightsSubtotal, s.monthlyDiscountPercent),
    };
  } else if (s.weeklyDiscountPercent > 0 && nights >= s.weeklyMinNights) {
    lengthDiscount = {
      label: "Weekly discount",
      percent: s.weeklyDiscountPercent,
      amount: pct(nightsSubtotal, s.weeklyDiscountPercent),
    };
  }
  const afterLength = nightsSubtotal - (lengthDiscount?.amount ?? 0);

  // The direct-booking discount applies on top, to the already-discounted nights.
  const directDiscount =
    s.directDiscountEnabled && s.directDiscountPercent > 0
      ? { percent: s.directDiscountPercent, amount: pct(afterLength, s.directDiscountPercent) }
      : null;

  const afterDirect = afterLength - (directDiscount?.amount ?? 0);

  // Influencer promo code: an extra discount on top of everything else.
  const promoDiscount =
    promo && promo.percent > 0 ? { ...promo, amount: pct(afterDirect, promo.percent) } : promo ? { ...promo, amount: 0 } : null;

  const accommodation = afterDirect - (promoDiscount?.amount ?? 0);
  const cleaningFee = s.cleaningFee;
  const petFee = stay.pets > 0 ? s.petFee : 0;
  const subtotal = accommodation + cleaningFee + petFee;
  // Florida taxes transient rentals on the full charge, fees included. Each line is rounded on its own.
  const taxes = s.taxes.map((t) => ({ ...t, amount: pct(subtotal, t.percent) }));
  const tax = taxes.reduce((sum, t) => sum + t.amount, 0);

  return {
    ...stay,
    nights,
    currency: "USD",
    weekdayNights,
    weekendNights,
    weekdayRate: s.baseNightly,
    weekendRate: wkRate,
    nightsSubtotal,
    lengthDiscount,
    directDiscount,
    promoDiscount,
    accommodation,
    cleaningFee,
    petFee,
    subtotal,
    taxes,
    tax,
    total: subtotal + tax,
  };
}

/** Fetch the calendar and settings for the stay and price it. */
/**
 * Fetch calendar + settings and price the stay.
 *  - promo: "strict" (default) fails if the code is invalid; "soft" prices without it and reports why.
 *  - frozenPromo: the promo already on a booking (trip changes keep it even if the code has since expired).
 */
export async function quoteStay(
  stay: StayRequest,
  opts: { forBooking?: boolean; replacing?: Replacing; frozenPromo?: AppliedPromo | null } = {},
): Promise<Quote> {
  return (await quoteStayWithPromo(stay, { ...opts, promoMode: "strict" })).quote;
}

export async function quoteStayWithPromo(
  stay: StayRequest,
  opts: {
    forBooking?: boolean;
    replacing?: Replacing;
    frozenPromo?: AppliedPromo | null;
    promoMode?: "strict" | "soft";
  } = {},
): Promise<{ quote: Quote; promoError: string | null }> {
  const s = await getSettings();
  if (!isISODate(stay.checkIn) || !isISODate(stay.checkOut) || stay.checkOut <= stay.checkIn) {
    throw new QuoteError("invalid", "Check-out must be after check-in.");
  }
  // Refuse absurd ranges before calling the API.
  if (nightsBetween(stay.checkIn, stay.checkOut) > s.maxNights) {
    throw new QuoteError("too_long", `Stays booked online can be up to ${s.maxNights} nights.`);
  }
  // Include the check-out day so its closed-for-checkout flag can be read.
  const days = await getDays(stay.checkIn, stay.checkOut, opts);

  let promo: AppliedPromo | null = opts.frozenPromo ?? null;
  let promoError: string | null = null;
  if (opts.frozenPromo === undefined && stay.promo) {
    try {
      promo = await validatePromo(stay.promo, stay.checkIn);
    } catch (err) {
      if (!(err instanceof PromoError)) throw err;
      if (opts.promoMode !== "soft") throw new QuoteError("promo", err.message);
      promoError = err.message;
    }
  }
  const quote = priceStay({ ...stay, promo: promo?.code }, days, s, todayAtProperty(), promo);
  return { quote, promoError };
}
