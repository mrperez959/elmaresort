import "server-only";
import { query } from "./db";
import type { BookingSummary, PublicUser, Quote } from "./types";

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  phone: string;
  email_verified_at: Date | null;
  session_version: number;
};

function toPublic(r: UserRow): PublicUser {
  return {
    id: r.id,
    email: r.email,
    firstName: r.first_name,
    lastName: r.last_name,
    phone: r.phone,
    emailVerified: r.email_verified_at !== null,
  };
}

/** US numbers become +1XXXXXXXXXX; others must include their country code. Null if not a phone number. */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function findUserById(id: string): Promise<(PublicUser & { sessionVersion: number }) | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await query<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
  return rows[0] ? { ...toPublic(rows[0]), sessionVersion: rows[0].session_version } : null;
}

export async function findUserWithHash(email: string) {
  const rows = await query<UserRow>("SELECT * FROM users WHERE email = $1", [normalizeEmail(email)]);
  return rows[0]
    ? { user: toPublic(rows[0]), passwordHash: rows[0].password_hash, sessionVersion: rows[0].session_version }
    : null;
}

export async function markEmailVerified(userId: string) {
  await query("UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1", [userId]);
}

/** New password; bumps the session version so every other device is signed out. */
export async function setPassword(userId: string, passwordHash: string): Promise<number> {
  const rows = await query<{ session_version: number }>(
    `UPDATE users SET password_hash = $2, session_version = session_version + 1,
       email_verified_at = COALESCE(email_verified_at, now())
     WHERE id = $1 RETURNING session_version`,
    [userId, passwordHash],
  );
  return rows[0].session_version;
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone: string;
}): Promise<PublicUser | null> {
  const rows = await query<UserRow>(
    `INSERT INTO users (email, password_hash, first_name, last_name, phone)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO NOTHING
     RETURNING *`,
    [normalizeEmail(input.email), input.passwordHash, input.firstName, input.lastName, input.phone],
  );
  return rows[0] ? { ...toPublic(rows[0]) } : null; // null = email already registered
}

/** Saves a confirmed booking. Throws a pg error with code 23P01 if the nights overlap another one. */
export async function insertBooking(b: {
  userId: string;
  code: string;
  squarePaymentId: string;
  quote: Quote;
  policy: string;
}) {
  const q = b.quote;
  const rows = await query<{ id: string }>(
    `WITH b AS (
       INSERT INTO bookings (user_id, code, square_payment_id, check_in, check_out,
         adults, children, infants, pets, total_cents, quote, policy, promo_code, commission_percent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id
     ), p AS (
       INSERT INTO payments (booking_id, square_payment_id, amount_cents, kind)
       SELECT id, $3, $10, 'booking' FROM b
     )
     SELECT id FROM b`,
    [b.userId, b.code, b.squarePaymentId, q.checkIn, q.checkOut,
     q.adults, q.children, q.infants, q.pets, q.total, JSON.stringify(q), b.policy,
     q.promoDiscount?.code ?? null, q.promoDiscount?.commissionPercent ?? null],
  );
  return rows[0].id;
}

export async function cancelBooking(id: string) {
  await query(`UPDATE bookings SET status = 'cancelled' WHERE id = $1`, [id]);
}

type BookingRow = {
  code: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  pets: number;
  total_cents: number;
  status: string;
  created_at: Date;
  quote?: Quote | null;
  refunded_cents?: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
};

const SELECT_BOOKING = `
  SELECT b.code, to_char(b.check_in, 'YYYY-MM-DD') AS check_in, to_char(b.check_out, 'YYYY-MM-DD') AS check_out,
         b.adults, b.children, b.pets, b.total_cents, b.status, b.created_at, b.quote, b.refunded_cents`;

function toSummary(r: BookingRow): BookingSummary {
  return {
    code: r.code,
    checkIn: r.check_in,
    checkOut: r.check_out,
    guests: r.adults + r.children,
    pets: r.pets,
    total: r.total_cents,
    status: r.status,
    createdAt: new Date(r.created_at).toISOString(),
    quote: r.quote && Array.isArray((r.quote as Quote).taxes) ? r.quote : null,
    refunded: r.refunded_cents ?? 0,
    ...(r.email ? { guestName: `${r.first_name} ${r.last_name}`, guestEmail: r.email, guestPhone: r.phone } : {}),
  };
}

export async function bookingsForUser(userId: string): Promise<BookingSummary[]> {
  const rows = await query<BookingRow>(
    `${SELECT_BOOKING} FROM bookings b WHERE b.user_id = $1 ORDER BY b.check_in DESC LIMIT 100`,
    [userId],
  );
  return rows.map(toSummary);
}

export async function recentBookings(limit = 50): Promise<BookingSummary[]> {
  const rows = await query<BookingRow>(
    `${SELECT_BOOKING}, u.first_name, u.last_name, u.email, u.phone
     FROM bookings b JOIN users u ON u.id = b.user_id
     ORDER BY b.created_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map(toSummary);
}
