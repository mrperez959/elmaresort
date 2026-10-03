// Cancellation policies, modeled on Airbnb's standard ones. Pure functions:
// used by the server to compute refunds and by the browser to show deadlines.
import type { Quote } from "./types";

export type PolicyId = "flexible" | "moderate" | "limited" | "firm";

export const POLICIES: Record<PolicyId, { name: string; summary: string }> = {
  flexible: {
    name: "Flexible",
    summary: "Full refund up to 24 hours before check-in. After that, the first night isn't refunded.",
  },
  moderate: {
    name: "Moderate",
    summary:
      "Full refund up to 5 days before check-in. After that, the first night isn't refunded and the other nights are refunded 50%.",
  },
  limited: {
    name: "Limited",
    summary:
      "Full refund up to 14 days before check-in. Between 14 and 7 days before, 50% of the nights are refunded. Less than 7 days before, nights aren't refunded.",
  },
  firm: {
    name: "Firm",
    summary:
      "Full refund up to 30 days before check-in. Between 30 and 7 days before, 50% of the nights are refunded. Less than 7 days before, nights aren't refunded.",
  },
};

export const POLICY_IDS = Object.keys(POLICIES) as PolicyId[];

export const isPolicyId = (v: unknown): v is PolicyId => typeof v === "string" && v in POLICIES;

export const GRACE_NOTE =
  "Any booking made at least 7 days before check-in can be cancelled for a full refund within 24 hours of booking.";

export const FEES_NOTE = "Cleaning and pet fees are always refunded if you cancel before check-in, with their taxes.";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** UTC instant for a wall-clock time in a time zone (e.g. 16:00 in Tampa on 2026-10-12). */
export function zonedInstant(dateISO: string, hour: number, timeZone = "America/New_York"): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, 0, 0);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess - (asIfUtc - guess));
}

export type Refund = {
  /** what the guest gets back, in cents */
  refund: number;
  nightsRefund: number;
  feesRefund: number;
  taxRefund: number;
  /** share of the nights refunded, 0..1 */
  nightsFraction: number;
  reason: string;
};

/**
 * Refund for cancelling the whole stay now. null = no longer possible online
 * (check-in time has passed).
 */
export function cancellationRefund(
  quote: Quote,
  policy: PolicyId,
  bookedAt: Date,
  now: Date,
  checkIn: Date,
): Refund | null {
  const left = checkIn.getTime() - now.getTime();
  if (left <= 0) return null;
  const nights = quote.accommodation;
  const firstNight = Math.round(nights / quote.nights);

  let nightsRefund: number;
  let reason: string;
  if (now.getTime() - bookedAt.getTime() <= DAY && left >= 7 * DAY) {
    nightsRefund = nights;
    reason = "Within 24 hours of booking";
  } else if (policy === "flexible") {
    nightsRefund = left >= DAY ? nights : nights - firstNight;
    reason = left >= DAY ? "More than 24 hours before check-in" : "Less than 24 hours before check-in";
  } else if (policy === "moderate") {
    nightsRefund = left >= 5 * DAY ? nights : Math.round((nights - firstNight) * 0.5);
    reason = left >= 5 * DAY ? "More than 5 days before check-in" : "Less than 5 days before check-in";
  } else {
    const full = policy === "firm" ? 30 : 14;
    if (left >= full * DAY) {
      nightsRefund = nights;
      reason = `More than ${full} days before check-in`;
    } else if (left >= 7 * DAY) {
      nightsRefund = Math.round(nights * 0.5);
      reason = `Between ${full} and 7 days before check-in`;
    } else {
      nightsRefund = 0;
      reason = "Less than 7 days before check-in";
    }
  }

  const feesRefund = quote.cleaningFee + quote.petFee;
  const taxRefund = quote.subtotal > 0 ? Math.round((quote.tax * (nightsRefund + feesRefund)) / quote.subtotal) : 0;
  return {
    refund: nightsRefund + feesRefund + taxRefund,
    nightsRefund,
    feesRefund,
    taxRefund,
    nightsFraction: nights > 0 ? nightsRefund / nights : 1,
    reason,
  };
}

/** Plain-language deadlines for a stay, for the checkout page and the trip page. */
export function policyDeadlines(policy: PolicyId, checkIn: Date, timeZone = "America/New_York"): string[] {
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    }).format(d);
  const before = (days: number) => new Date(checkIn.getTime() - days * DAY);
  switch (policy) {
    case "flexible":
      return [`Full refund if you cancel before ${fmt(before(1))}.`, "After that, the first night isn't refunded."];
    case "moderate":
      return [
        `Full refund if you cancel before ${fmt(before(5))}.`,
        "After that, the first night isn't refunded and the other nights are refunded 50%.",
      ];
    case "limited":
      return [
        `Full refund if you cancel before ${fmt(before(14))}.`,
        `50% of the nights refunded if you cancel before ${fmt(before(7))}.`,
        "After that, nights aren't refunded.",
      ];
    case "firm":
      return [
        `Full refund if you cancel before ${fmt(before(30))}.`,
        `50% of the nights refunded if you cancel before ${fmt(before(7))}.`,
        "After that, nights aren't refunded.",
      ];
  }
}
