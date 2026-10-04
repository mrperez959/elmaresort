import "server-only";
import { Pool, type QueryResultRow } from "pg";

// One small pool per server instance. On Vercel use the *pooled* connection
// string from Neon (or any Postgres) in DATABASE_URL.
const globalForDb = globalThis as unknown as { __elmaPool?: Pool; __elmaSchema?: Promise<void> };

function pool(): Pool {
  if (!globalForDb.__elmaPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Missing environment variable DATABASE_URL. See .env.example.");
    // pg warns that "sslmode=require" will change meaning in v9; ask for the
    // strict mode it already uses today (Neon supports it) so behavior stays the same.
    const connectionString = url.replace(/sslmode=(prefer|require|verify-ca)\b/, "sslmode=verify-full");
    globalForDb.__elmaPool = new Pool({ connectionString, max: 3 });
  }
  return globalForDb.__elmaPool;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  id          int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data        jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE,
  password_hash  text NOT NULL,
  first_name     text NOT NULL,
  last_name      text NOT NULL,
  phone          text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id),
  hospitable_id      text,
  code               text NOT NULL,
  square_payment_id  text NOT NULL,
  check_in           date NOT NULL,
  check_out          date NOT NULL,
  adults             int NOT NULL,
  children           int NOT NULL DEFAULT 0,
  infants            int NOT NULL DEFAULT 0,
  pets               int NOT NULL DEFAULT 0,
  total_cents        int NOT NULL,
  quote              jsonb NOT NULL,
  status             text NOT NULL DEFAULT 'confirmed',
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bookings_user_idx ON bookings (user_id, check_in DESC);
CREATE INDEX IF NOT EXISTS bookings_created_idx ON bookings (created_at DESC);

-- Older installs required a Hospitable reservation id; direct bookings no longer have one.
ALTER TABLE bookings ALTER COLUMN hospitable_id DROP NOT NULL;

-- The database itself refuses two confirmed direct bookings on the same nights,
-- even if two guests pay at the same second.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_no_overlap') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
      EXCLUDE USING gist (daterange(check_in, check_out) WITH &&) WHERE (status = 'confirmed');
  END IF;
END $$;

-- Cancellation policy in force when the guest booked, and refund bookkeeping.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS policy text NOT NULL DEFAULT 'moderate';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refunded_cents int NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Every card payment on a booking (the original plus any paid date changes),
-- so refunds can be taken from the right one.
CREATE TABLE IF NOT EXISTS payments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id         uuid NOT NULL REFERENCES bookings(id),
  square_payment_id  text NOT NULL,
  amount_cents       int NOT NULL,
  refunded_cents     int NOT NULL DEFAULT 0,
  kind               text NOT NULL DEFAULT 'booking',
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_booking_idx ON payments (booking_id);
INSERT INTO payments (booking_id, square_payment_id, amount_cents)
  SELECT b.id, b.square_payment_id, b.total_cents FROM bookings b
  WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = b.id);

-- Email verification and session revocation.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version int NOT NULL DEFAULT 1;

-- One-time codes sent by email (stored hashed, never in clear).
CREATE TABLE IF NOT EXISTS email_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  purpose     text NOT NULL,
  code_hash   text NOT NULL,
  attempts    int NOT NULL DEFAULT 0,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_codes_lookup ON email_codes (email, purpose, created_at DESC);

-- Rate limits shared by every server instance (in-memory counters don't work on serverless).
CREATE TABLE IF NOT EXISTS rate_limits (
  key           text PRIMARY KEY,
  window_start  timestamptz NOT NULL,
  count         int NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  month       text NOT NULL,
  platform    text NOT NULL,
  rating      int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
`;

/** Creates the tables on first use. Safe to run any number of times. */
function ensureSchema(): Promise<void> {
  if (!globalForDb.__elmaSchema) {
    globalForDb.__elmaSchema = pool()
      .query(SCHEMA)
      .then(() => undefined)
      .catch((err) => {
        globalForDb.__elmaSchema = undefined;
        throw err;
      });
  }
  return globalForDb.__elmaSchema;
}

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  const result = await pool().query<T>(text, params);
  return result.rows;
}

/** Postgres error code for an exclusion-constraint violation (overlapping dates). */
export const OVERLAP_ERROR = "23P01";
