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
};

function toPublic(r: UserRow): PublicUser {
  return { id: r.id, email: r.email, firstName: r.first_name, lastName: r.last_name, phone: r.phone };
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function findUserById(id: string): Promise<PublicUser | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await query<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
  return rows[0] ? toPublic(rows[0]) : null;
}

export async function findUserWithHash(email: string) {
  const rows = await query<UserRow>("SELECT * FROM users WHERE email = $1", [normalizeEmail(email)]);
  return rows[0] ? { user: toPublic(rows[0]), passwordHash: rows[0].password_hash } : null;
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
  return rows[0] ? toPublic(rows[0]) : null; // null = email already registered
}

export async function insertBooking(b: {
  userId: string;
  hospitableId: string;
  code: string;
  squarePaymentId: string;
  quote: Quote;
}) {
  const q = b.quote;
  await query(
    `INSERT INTO bookings (user_id, hospitable_id, code, square_payment_id, check_in, check_out,
       adults, children, infants, pets, total_cents, quote)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [b.userId, b.hospitableId, b.code, b.squarePaymentId, q.checkIn, q.checkOut,
     q.adults, q.children, q.infants, q.pets, q.total, JSON.stringify(q)],
  );
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
  first_name?: string;
  last_name?: string;
  email?: string;
};

const SELECT_BOOKING = `
  SELECT b.code, to_char(b.check_in, 'YYYY-MM-DD') AS check_in, to_char(b.check_out, 'YYYY-MM-DD') AS check_out,
         b.adults, b.children, b.pets, b.total_cents, b.status, b.created_at`;

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
    ...(r.email ? { guestName: `${r.first_name} ${r.last_name}`, guestEmail: r.email } : {}),
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
    `${SELECT_BOOKING}, u.first_name, u.last_name, u.email
     FROM bookings b JOIN users u ON u.id = b.user_id
     ORDER BY b.created_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map(toSummary);
}
