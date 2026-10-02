import "server-only";
import { Pool, type QueryResultRow } from "pg";

// One small pool per server instance. On Vercel use the *pooled* connection
// string from Neon (or any Postgres) in DATABASE_URL.
const globalForDb = globalThis as unknown as { __elmaPool?: Pool; __elmaSchema?: Promise<void> };

function pool(): Pool {
  if (!globalForDb.__elmaPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Missing environment variable DATABASE_URL. See .env.example.");
    globalForDb.__elmaPool = new Pool({ connectionString: url, max: 3 });
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
  hospitable_id      text NOT NULL,
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
