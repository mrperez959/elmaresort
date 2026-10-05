import "server-only";
import { query } from "./db";
import type { Quote } from "./types";

export type BookingRecord = {
  code: string;
  status: string;
  bookedOn: string;
  checkIn: string;
  checkOut: string;
  guest: string;
  email: string;
  phone: string;
  quote: Quote;
  paid: number;
  refunded: number;
  promo: string | null;
};

export async function allBookings(): Promise<BookingRecord[]> {
  const rows = await query<{
    code: string;
    status: string;
    booked_on: string;
    check_in: string;
    check_out: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    quote: Quote;
    total_cents: number;
    refunded_cents: number;
    promo_code: string | null;
  }>(
    `SELECT b.code, b.status, to_char(b.created_at AT TIME ZONE 'America/New_York', 'YYYY-MM-DD') AS booked_on,
            to_char(b.check_in, 'YYYY-MM-DD') AS check_in, to_char(b.check_out, 'YYYY-MM-DD') AS check_out,
            u.first_name, u.last_name, u.email, u.phone, b.quote, b.total_cents, b.refunded_cents, b.promo_code
     FROM bookings b JOIN users u ON u.id = b.user_id
     WHERE b.quote ? 'subtotal'
     ORDER BY b.created_at`,
  );
  return rows.map((r) => ({
    code: r.code,
    status: r.status,
    bookedOn: r.booked_on,
    checkIn: r.check_in,
    checkOut: r.check_out,
    guest: `${r.first_name} ${r.last_name}`,
    email: r.email,
    phone: r.phone,
    quote: r.quote,
    paid: r.total_cents,
    refunded: r.refunded_cents,
    promo: r.promo_code,
  }));
}

export type MonthRow = {
  month: string;
  bookings: number;
  nights: number;
  accommodation: number;
  cleaning: number;
  pets: number;
  subtotal: number;
  taxes: Record<string, number>;
  taxTotal: number;
  collected: number;
};

/**
 * Money kept per month, by the month the guest paid (booking date). Refunds
 * reduce every line in proportion. Confirm the basis with your accountant.
 */
export function monthlyReport(bookings: BookingRecord[], year: number): { rows: MonthRow[]; taxNames: string[] } {
  const taxNames = new Set<string>();
  const months = new Map<string, MonthRow>();
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    months.set(key, { month: key, bookings: 0, nights: 0, accommodation: 0, cleaning: 0, pets: 0, subtotal: 0, taxes: {}, taxTotal: 0, collected: 0 });
  }
  for (const b of bookings) {
    const row = months.get(b.bookedOn.slice(0, 7));
    if (!row) continue;
    const q = b.quote;
    const kept = b.paid > 0 ? Math.max(0, Math.min(1, (b.paid - b.refunded) / b.paid)) : 0;
    if (kept === 0) continue;
    row.bookings += 1;
    row.nights += b.status === "confirmed" ? q.nights : 0;
    row.accommodation += Math.round(q.accommodation * kept);
    row.cleaning += Math.round(q.cleaningFee * kept);
    row.pets += Math.round(q.petFee * kept);
    row.subtotal += Math.round(q.subtotal * kept);
    for (const t of q.taxes ?? []) {
      taxNames.add(t.name);
      row.taxes[t.name] = (row.taxes[t.name] ?? 0) + Math.round(t.amount * kept);
    }
    row.taxTotal += Math.round(q.tax * kept);
    row.collected += b.paid - b.refunded;
  }
  return { rows: [...months.values()], taxNames: [...taxNames] };
}
