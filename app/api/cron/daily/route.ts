import { query } from "@/lib/db";
import { todayAtProperty, addDays } from "@/lib/dates";
import { sendCheckInDay, sendAfterStay, sendStillAvailable } from "@/lib/emails";
import { quoteStay, QuoteError } from "@/lib/quote";
import { alertOwner } from "@/lib/alerts";
import type { StayRequest } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Runs once a day (vercel.json). Vercel calls it with "Authorization: Bearer $CRON_SECRET".
 *  1. Check-in day email (address, door code...) for today's arrivals.
 *  2. Thank-you / review email the day after check-out.
 *  3. "Your dates are still open" to guests who reached checkout but didn't pay (once per stay).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const today = todayAtProperty();
  const report = { checkIn: 0, afterStay: 0, stillAvailable: 0, errors: 0 };

  type Row = { id: string; code: string; email: string; first_name: string; lang: string };
  const lang = (l: string) => (l === "es" ? "es" : "en") as "en" | "es";

  const arrivals = await query<Row>(
    `SELECT b.id, b.code, u.email, u.first_name, u.lang FROM bookings b JOIN users u ON u.id = b.user_id
     WHERE b.status = 'confirmed' AND b.check_in = $1::date AND b.checkin_emailed_at IS NULL`,
    [today],
  );
  for (const r of arrivals) {
    try {
      await sendCheckInDay(r.email, r.first_name, lang(r.lang), r.code);
      await query("UPDATE bookings SET checkin_emailed_at = now() WHERE id = $1", [r.id]);
      report.checkIn++;
    } catch (err) {
      report.errors++;
      await alertOwner("check-in email", err, r.code);
    }
  }

  const departed = await query<Row>(
    `SELECT b.id, b.code, u.email, u.first_name, u.lang FROM bookings b JOIN users u ON u.id = b.user_id
     WHERE b.status = 'confirmed' AND b.check_out = $1::date AND b.review_emailed_at IS NULL`,
    [addDays(today, -1)],
  );
  for (const r of departed) {
    try {
      await sendAfterStay(r.email, r.first_name, lang(r.lang));
      await query("UPDATE bookings SET review_emailed_at = now() WHERE id = $1", [r.id]);
      report.afterStay++;
    } catch (err) {
      report.errors++;
      await alertOwner("after-stay email", err, r.code);
    }
  }

  // Abandoned checkouts: at least 3 hours old, at most 7 days, no booking made since.
  const intents = await query<{ user_id: string; stay: StayRequest; email: string; first_name: string; lang: string }>(
    `SELECT i.user_id, i.stay, u.email, u.first_name, u.lang FROM checkout_intents i JOIN users u ON u.id = i.user_id
     WHERE i.emailed_at IS NULL AND i.updated_at < now() - interval '3 hours' AND i.updated_at > now() - interval '7 days'
       AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.user_id = i.user_id AND b.created_at > i.updated_at - interval '1 hour')`,
  );
  for (const i of intents) {
    try {
      if (i.stay.checkIn <= today) {
        await query("UPDATE checkout_intents SET emailed_at = now() WHERE user_id = $1", [i.user_id]);
        continue;
      }
      // Only email if the dates are really still open (fresh calendars).
      const q = await quoteStay(i.stay, { forBooking: true });
      const params = new URLSearchParams({
        checkIn: q.checkIn,
        checkOut: q.checkOut,
        adults: String(q.adults),
        children: String(q.children),
        infants: String(q.infants),
        pets: String(q.pets),
        ...(q.promoDiscount ? { promo: q.promoDiscount.code } : {}),
      });
      await sendStillAvailable(i.email, i.first_name, lang(i.lang), `/checkout?${params}`, q);
      report.stillAvailable++;
    } catch (err) {
      if (!(err instanceof QuoteError)) {
        report.errors++;
        await alertOwner("still-available email", err);
        continue;
      }
    }
    await query("UPDATE checkout_intents SET emailed_at = now() WHERE user_id = $1", [i.user_id]);
  }

  console.info("[cron/daily]", report);
  return Response.json(report);
}
