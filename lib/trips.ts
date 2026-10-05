import "server-only";
import { randomUUID } from "node:crypto";
import { query, OVERLAP_ERROR } from "./db";
import { square, cardDeclineMessage } from "./square";
import { env } from "./env";
import { getSettings } from "./settings";
import { quoteStay, QuoteError } from "./quote";
import { cancellationRefund, isPolicyId, zonedInstant, type PolicyId, type Refund } from "./policy";
import type { Quote, StayRequest } from "./types";

export type Trip = {
  id: string;
  code: string;
  userId: string;
  status: string;
  policy: PolicyId;
  quote: Quote;
  paid: number; // net cents still held for this trip
  refunded: number;
  createdAt: Date;
  checkInAt: Date;
  guestName: string;
  guestEmail: string;
};

type Row = {
  id: string;
  code: string;
  user_id: string;
  status: string;
  policy: string;
  quote: Quote;
  total_cents: number;
  refunded_cents: number;
  created_at: Date;
  first_name: string;
  last_name: string;
  email: string;
};

export class TripError extends Error {}

/** A booking with a full saved quote. With userId, only if it belongs to that guest. */
export async function getTrip(code: string, userId: string | null): Promise<Trip | null> {
  const rows = await query<Row>(
    `SELECT b.*, u.first_name, u.last_name, u.email FROM bookings b JOIN users u ON u.id = b.user_id
     WHERE b.code = $1 AND ($2::uuid IS NULL OR b.user_id = $2::uuid)`,
    [code, userId],
  );
  const r = rows[0];
  if (!r || !r.quote || !Array.isArray(r.quote.taxes)) return null;
  const { checkInHour } = await getSettings();
  return {
    id: r.id,
    code: r.code,
    userId: r.user_id,
    status: r.status,
    policy: isPolicyId(r.policy) ? r.policy : "moderate",
    quote: r.quote,
    paid: r.total_cents - r.refunded_cents,
    refunded: r.refunded_cents,
    createdAt: new Date(r.created_at),
    checkInAt: zonedInstant(r.quote.checkIn, checkInHour),
    guestName: `${r.first_name} ${r.last_name}`,
    guestEmail: r.email,
  };
}

export const canChange = (t: Trip) => t.status === "confirmed" && t.checkInAt.getTime() > Date.now();

export function refundNow(t: Trip): Refund | null {
  const r = cancellationRefund(t.quote, t.policy, t.createdAt, new Date(), t.checkInAt);
  return r ? { ...r, refund: Math.min(r.refund, t.paid) } : null;
}

/** Send `amount` back to the card(s), newest payment first. */
async function refundToCard(bookingId: string, amount: number, reason: string) {
  let left = amount;
  const payments = await query<{ id: string; square_payment_id: string; amount_cents: number; refunded_cents: number }>(
    "SELECT * FROM payments WHERE booking_id = $1 ORDER BY created_at DESC",
    [bookingId],
  );
  for (const p of payments) {
    if (left <= 0) break;
    const available = p.amount_cents - p.refunded_cents;
    const take = Math.min(available, left);
    if (take <= 0) continue;
    await square().refunds.refundPayment({
      idempotencyKey: randomUUID(),
      paymentId: p.square_payment_id,
      amountMoney: { amount: BigInt(take), currency: "USD" },
      reason: reason.slice(0, 192),
    });
    await query("UPDATE payments SET refunded_cents = refunded_cents + $2 WHERE id = $1", [p.id, take]);
    await query("UPDATE bookings SET refunded_cents = refunded_cents + $2 WHERE id = $1", [bookingId, take]);
    left -= take;
  }
  if (left > 0) throw new TripError("Part of the refund couldn't be sent. We'll contact you.");
}

/** Cancel a trip. `full` (admin only) refunds everything paid regardless of the policy. */
export async function cancelTrip(t: Trip, { full = false } = {}): Promise<{ refunded: number }> {
  if (t.status !== "confirmed") throw new TripError("This trip is already cancelled.");
  let amount: number;
  if (full) amount = t.paid;
  else {
    const r = refundNow(t);
    if (!r) throw new TripError("Check-in time has passed. Contact us to make changes to this stay.");
    amount = r.refund;
  }
  // Free the dates first so nobody is blocked if the card refund takes a retry.
  const rows = await query<{ id: string }>(
    "UPDATE bookings SET status = 'cancelled', cancelled_at = now() WHERE id = $1 AND status = 'confirmed' RETURNING id",
    [t.id],
  );
  if (!rows.length) throw new TripError("This trip is already cancelled.");
  if (amount > 0) {
    try {
      await refundToCard(t.id, amount, `Cancellation of ${t.code}`);
    } catch (err) {
      console.error(`[trips] refund failed for cancelled ${t.code}`, err);
      throw new TripError(
        "Your trip was cancelled, but the refund didn't go through automatically. We'll send it to your card and contact you.",
      );
    }
  }
  return { refunded: amount };
}

export type ChangePreview = {
  next: Quote;
  /** > 0 the guest pays this; < 0 the guest gets this back; 0 no money moves */
  difference: number;
  note: string;
};

/** New price for a change, and how much moves either way. */
export async function previewChange(t: Trip, stay: StayRequest): Promise<ChangePreview> {
  if (!canChange(t)) throw new TripError("This trip can't be changed online anymore. Contact us.");
  const pd = t.quote.promoDiscount;
  const next = await quoteStay(stay, {
    forBooking: true,
    replacing: { id: t.id, start: t.quote.checkIn, end: t.quote.checkOut },
    // The promo code the guest booked with stays on the trip, even if the code has expired since.
    frozenPromo: pd ? { code: pd.code, percent: pd.percent, commissionPercent: pd.commissionPercent } : null,
  });
  const cur = t.quote;
  const up = next.total - cur.total;
  if (up >= 0) {
    return {
      next,
      difference: up,
      note: up > 0 ? "The new total is higher. You'll pay the difference now." : "The total stays the same.",
    };
  }
  // Lower total: refund what the cancellation policy allows for the removed part.
  const policy = refundNow(t);
  const fraction = policy?.nightsFraction ?? 0;
  const nightsDown = Math.max(0, cur.accommodation - next.accommodation);
  const feesDown = Math.max(0, cur.cleaningFee + cur.petFee - (next.cleaningFee + next.petFee));
  const base = Math.round(nightsDown * fraction) + feesDown;
  const tax = cur.subtotal > 0 ? Math.round((cur.tax * base) / cur.subtotal) : 0;
  const refund = Math.min(base + tax, -up, t.paid);
  return {
    next,
    difference: -refund,
    note:
      refund === -up
        ? "The new total is lower. The difference goes back to your card."
        : `The new total is lower. Under the ${t.policy} cancellation policy, ${refund > 0 ? "part of the difference" : "none of the difference"} is refunded.`,
  };
}

/** Apply a change. When the guest owes money, `card` must carry a fresh Square token. */
export async function applyChange(
  t: Trip,
  stay: StayRequest,
  expectedDifference: number,
  card?: { sourceId: string; idempotencyKey: string },
): Promise<ChangePreview> {
  const preview = await previewChange(t, stay);
  if (preview.difference !== expectedDifference) {
    throw new TripError("The price for this change just changed. Review it and try again.");
  }
  const q = preview.next;

  let paymentId: string | null = null;
  if (preview.difference > 0) {
    if (!card) throw new TripError("Enter a card to pay the difference.");
    try {
      const { payment } = await square().payments.create({
        sourceId: card.sourceId,
        idempotencyKey: card.idempotencyKey,
        amountMoney: { amount: BigInt(preview.difference), currency: "USD" },
        autocomplete: false,
        delayDuration: "PT30M",
        delayAction: "CANCEL",
        locationId: env.squareLocationId(),
        buyerEmailAddress: t.guestEmail,
        note: `Change to ${t.code}: ${q.checkIn} to ${q.checkOut}`,
      });
      if (!payment?.id || payment.status !== "APPROVED") throw new TripError("Your card couldn't be authorized.");
      paymentId = payment.id;
    } catch (err) {
      const msg = cardDeclineMessage(err);
      if (msg) throw new TripError(msg);
      throw err;
    }
  }

  try {
    await query(
      `UPDATE bookings SET check_in = $2, check_out = $3, adults = $4, children = $5, infants = $6, pets = $7,
         total_cents = total_cents + $8, quote = $9, updated_at = now()
       WHERE id = $1 AND status = 'confirmed'`,
      [t.id, q.checkIn, q.checkOut, q.adults, q.children, q.infants, q.pets,
       preview.difference > 0 ? preview.difference : 0, JSON.stringify(q)],
    );
  } catch (err) {
    if (paymentId) await square().payments.cancel({ paymentId }).catch(() => undefined);
    if ((err as { code?: string }).code === OVERLAP_ERROR) throw new TripError("Those dates were just booked by someone else.");
    throw err;
  }

  if (paymentId) {
    try {
      await square().payments.complete({ paymentId });
    } catch (err) {
      // Put the trip back as it was; the card hold expires on its own.
      const c = t.quote;
      await query(
        `UPDATE bookings SET check_in = $2, check_out = $3, adults = $4, children = $5, infants = $6, pets = $7,
           total_cents = total_cents - $8, quote = $9 WHERE id = $1`,
        [t.id, c.checkIn, c.checkOut, c.adults, c.children, c.infants, c.pets, preview.difference, JSON.stringify(c)],
      ).catch((e) => console.error(`[trips] could not revert ${t.code}`, e));
      await square().payments.cancel({ paymentId }).catch(() => undefined);
      throw err;
    }
    await query(
      "INSERT INTO payments (booking_id, square_payment_id, amount_cents, kind) VALUES ($1, $2, $3, 'change')",
      [t.id, paymentId, preview.difference],
    );
  } else if (preview.difference < 0) {
    try {
      await refundToCard(t.id, -preview.difference, `Change to ${t.code}`);
    } catch (err) {
      console.error(`[trips] refund failed for change to ${t.code}`, err);
      throw new TripError(
        "Your trip was updated, but the refund didn't go through automatically. We'll send it to your card and contact you.",
      );
    }
  }
  return preview;
}

export { QuoteError };
