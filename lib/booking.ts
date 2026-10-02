import "server-only";
import { HospitableError } from "hospitable";
import { square, cardDeclineMessage } from "./square";
import { clearCalendarCache, hospitable } from "./hospitable";
import { env } from "./env";
import { quoteStay, QuoteError } from "./quote";
import { insertBooking } from "./users";
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

/** Hospitable refused the reservation itself (dates taken, bad data). */
function isRejection(err: unknown): boolean {
  return err instanceof HospitableError && [400, 409, 422].includes(err.statusCode);
}

async function voidPayment(paymentId: string) {
  try {
    await square().payments.cancel({ paymentId });
  } catch (err) {
    // If this fails Square still voids it automatically after delayDuration.
    console.error(`[booking] could not void payment ${paymentId}`, err);
  }
}

/**
 * Book a stay in one request:
 *   1. re-price the stay from fresh Hospitable data
 *   2. AUTHORIZE the card (autocomplete: false) -> nothing is charged yet
 *   3. create the manual reservation in Hospitable
 *   4. only if that works, CAPTURE the payment
 * If anything after step 2 fails, the authorization is voided. If the server
 * dies mid-way, Square voids it on its own after 30 minutes (delayAction CANCEL).
 */
export async function bookStay({ stay, guest, sourceId, idempotencyKey, expectedTotal }: BookInput): Promise<BookResult> {
  // 1. Price
  let quote;
  try {
    quote = await quoteStay(stay, { fresh: true });
  } catch (err) {
    if (err instanceof QuoteError) return { state: "error", message: err.message };
    throw err;
  }
  if (quote.total !== expectedTotal) {
    return {
      state: "price_changed",
      message: "The total for these dates just changed. Review it and pay again.",
      quote,
    };
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
    // Unknown outcome (e.g. timeout): void anything this key may have created.
    await square().payments.cancelByIdempotencyKey({ idempotencyKey }).catch(() => undefined);
    throw err;
  }

  // 3. Reserve
  let reservationId: string;
  let code: string;
  try {
    const reservation = await hospitable().reservations.create({
      propertyId: env.propertyId(),
      checkIn: quote.checkIn,
      checkOut: quote.checkOut,
      language: "en",
      notes: `Direct booking from website. Square payment ${paymentId}.`,
      guest: {
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.email,
        phone: guest.phone || undefined,
      },
      guests: { adults: quote.adults, children: quote.children, infants: quote.infants, pets: quote.pets },
      financials: {
        currency: "USD",
        accommodation: quote.accommodation,
        cleaningFee: quote.cleaningFee,
        petFee: quote.petFee || undefined,
        // Florida sales tax + county taxes you collect and remit yourself
        passThroughTaxes: quote.tax,
      },
    });
    reservationId = reservation.id;
    code = reservation.code ?? reservation.id;
  } catch (err) {
    await voidPayment(paymentId);
    if (isRejection(err)) {
      console.warn(`[booking] Hospitable rejected ${quote.checkIn}..${quote.checkOut}`, err);
      clearCalendarCache();
      return {
        state: "released",
        message:
          "Those dates were booked by someone else a moment ago. Your card was not charged and the hold was released.",
      };
    }
    throw err;
  }

  // Save it for the guest's account page and the admin panel. A failure here
  // doesn't undo the stay: it's already in Hospitable and paid.
  const record = () =>
    insertBooking({ userId: guest.id, hospitableId: reservationId, code, squarePaymentId: paymentId, quote }).catch(
      (err) => console.error(`[booking] paid booking ${code} could not be saved to the database`, err),
    );

  // 4. Capture
  try {
    await square().payments.complete({ paymentId });
  } catch (err) {
    // The capture may have gone through even if the response didn't reach us.
    const check = await square().payments.get({ paymentId }).catch(() => null);
    if (check?.payment?.status === "COMPLETED") {
      clearCalendarCache();
      await record();
      return { state: "confirmed", code, quote, firstName: guest.firstName };
    }
    console.error(`[booking] capture failed for ${paymentId}; cancelling reservation ${reservationId}`, err);
    await hospitable()
      .reservations.cancel(reservationId, "host")
      .catch((e) => console.error(`[booking] could not cancel reservation ${reservationId}`, e));
    await voidPayment(paymentId);
    clearCalendarCache();
    throw err;
  }

  clearCalendarCache();
  await record();
  return { state: "confirmed", code, quote, firstName: guest.firstName };
}
