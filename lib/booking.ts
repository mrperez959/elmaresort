import "server-only";
import { randomBytes } from "node:crypto";
import { square, cardDeclineMessage } from "./square";
import { env } from "./env";
import { quoteStay, QuoteError } from "./quote";
import { getSettings } from "./settings";
import { insertBooking, cancelBooking } from "./users";
import { OVERLAP_ERROR } from "./db";
import type { BookResult, PublicUser, StayRequest } from "./types";

type BookInput = {
  stay: StayRequest;
  /** the signed-in guest */
  guest: PublicUser;
  /** single-use card token from the Square Web Payments SDK */
  sourceId: string;
  /** unique per payment attempt, generated in the browser */
  idempotencyKey: string;
  /** total (cents) the guest saw when they clicked Pay */
  expectedTotal: number;
};

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I

function newCode(): string {
  const bytes = randomBytes(8);
  return "ER" + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

async function voidPayment(paymentId: string) {
  try {
    await square().payments.cancel({ paymentId });
  } catch (err) {
    // If this fails Square still voids it automatically after delayDuration.
    console.error(`[booking] could not void payment ${paymentId}`, err);
  }
}

const TAKEN: BookResult = {
  state: "released",
  message: "Those dates were booked by someone else a moment ago. Your card was not charged and the hold was released.",
};

/**
 * Book a stay in one request:
 *   1. re-check availability (fresh Airbnb/Vrbo calendars) and re-price
 *   2. AUTHORIZE the card (autocomplete: false): nothing is charged yet
 *   3. save the booking; the database refuses overlapping direct bookings
 *   4. only if that works, CAPTURE the payment
 * If anything after step 2 fails, the authorization is voided. If the server
 * dies mid-way, Square voids it on its own after 30 minutes.
 *
 * Airbnb and Vrbo learn about the booking through the site's own calendar
 * feed (/calendar/<token>.ics), which they re-import every few hours.
 */
export async function bookStay({ stay, guest, sourceId, idempotencyKey, expectedTotal }: BookInput): Promise<BookResult> {
  // 1. Availability + price
  let quote;
  try {
    quote = await quoteStay(stay, { forBooking: true });
  } catch (err) {
    if (err instanceof QuoteError) return { state: "error", message: err.message };
    throw err;
  }
  if (quote.total !== expectedTotal) {
    return { state: "price_changed", message: "The total for these dates just changed. Review it and pay again.", quote };
  }

  // 2. Authorize
  let paymentId: string;
  try {
    const { payment } = await square().payments.create({
      sourceId,
      idempotencyKey,
      amountMoney: { amount: BigInt(quote.total), currency: "USD" },
      autocomplete: false,
      delayDuration: "PT30M",
      delayAction: "CANCEL",
      locationId: env.squareLocationId(),
      buyerEmailAddress: guest.email,
      note: `${env.propertyName()} ${quote.checkIn} to ${quote.checkOut}, ${guest.firstName} ${guest.lastName}`.slice(0, 500),
    });
    if (!payment?.id || payment.status !== "APPROVED") {
      if (payment?.id) await voidPayment(payment.id);
      return { state: "declined", message: "Your card couldn't be authorized. Try a different card." };
    }
    paymentId = payment.id;
  } catch (err) {
    const message = cardDeclineMessage(err);
    if (message) return { state: "declined", message };
    await square().payments.cancelByIdempotencyKey({ idempotencyKey }).catch(() => undefined);
    throw err;
  }

  // 3. Save (the exclusion constraint is the final double-booking guard)
  const code = newCode();
  let bookingId: string;
  try {
    const { cancellationPolicy } = await getSettings();
    bookingId = await insertBooking({ userId: guest.id, code, squarePaymentId: paymentId, quote, policy: cancellationPolicy });
  } catch (err) {
    await voidPayment(paymentId);
    if ((err as { code?: string }).code === OVERLAP_ERROR) return TAKEN;
    throw err;
  }

  // 4. Capture
  try {
    await square().payments.complete({ paymentId });
  } catch (err) {
    // The capture may have gone through even if the response didn't reach us.
    const check = await square().payments.get({ paymentId }).catch(() => null);
    if (check?.payment?.status === "COMPLETED") {
      return { state: "confirmed", code, quote, firstName: guest.firstName };
    }
    console.error(`[booking] capture failed for ${paymentId}; cancelling booking ${code}`, err);
    await cancelBooking(bookingId).catch((e) => console.error(`[booking] could not cancel ${code}`, e));
    await voidPayment(paymentId);
    throw err;
  }

  return { state: "confirmed", code, quote, firstName: guest.firstName };
}
