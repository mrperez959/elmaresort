import "server-only";
import { query } from "./db";
import { todayAtProperty } from "./dates";
import type { AppliedPromo } from "./types";

export type Promo = {
  id: string;
  code: string;
  influencer: string;
  contact: string;
  guestPercent: number;
  commissionPercent: number;
  redeemFrom: string | null;
  redeemTo: string | null;
  stayFrom: string | null;
  stayTo: string | null;
  maxUses: number | null;
  active: boolean;
  createdAt: string;
};

type Row = {
  id: string;
  code: string;
  influencer: string;
  contact: string;
  guest_percent: string;
  commission_percent: string;
  redeem_from: string | null;
  redeem_to: string | null;
  stay_from: string | null;
  stay_to: string | null;
  max_uses: number | null;
  active: boolean;
  created_at: Date;
};

const COLS = `id, code, influencer, contact, guest_percent, commission_percent,
  to_char(redeem_from, 'YYYY-MM-DD') AS redeem_from, to_char(redeem_to, 'YYYY-MM-DD') AS redeem_to,
  to_char(stay_from, 'YYYY-MM-DD') AS stay_from, to_char(stay_to, 'YYYY-MM-DD') AS stay_to,
  max_uses, active, created_at`;

const toPromo = (r: Row): Promo => ({
  id: r.id,
  code: r.code,
  influencer: r.influencer,
  contact: r.contact,
  guestPercent: Number(r.guest_percent),
  commissionPercent: Number(r.commission_percent),
  redeemFrom: r.redeem_from,
  redeemTo: r.redeem_to,
  stayFrom: r.stay_from,
  stayTo: r.stay_to,
  maxUses: r.max_uses,
  active: r.active,
  createdAt: new Date(r.created_at).toISOString(),
});

export const normalizeCode = (raw: string) => raw.trim().toUpperCase().replace(/\s+/g, "");
const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,23}$/;

export class PromoError extends Error {}

const human = (d: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${d}T12:00:00Z`),
  );

/**
 * Check a code for a stay. Throws PromoError with a message for the guest.
 * Booking-window dates use the property's local date.
 */
export async function validatePromo(raw: string, checkIn: string): Promise<AppliedPromo> {
  const code = normalizeCode(raw);
  if (!CODE_RE.test(code)) throw new PromoError("That promo code isn't valid.");
  const rows = await query<Row>(`SELECT ${COLS} FROM promo_codes WHERE code = $1`, [code]);
  const p = rows[0] ? toPromo(rows[0]) : null;
  if (!p || !p.active) throw new PromoError("That promo code isn't valid.");

  const today = todayAtProperty();
  if (p.redeemFrom && today < p.redeemFrom) throw new PromoError(`That code can be used starting ${human(p.redeemFrom)}.`);
  if (p.redeemTo && today > p.redeemTo) throw new PromoError("That promo code has expired.");
  if ((p.stayFrom && checkIn < p.stayFrom) || (p.stayTo && checkIn > p.stayTo)) {
    const range =
      p.stayFrom && p.stayTo
        ? `between ${human(p.stayFrom)} and ${human(p.stayTo)}`
        : p.stayFrom
          ? `from ${human(p.stayFrom)}`
          : `until ${human(p.stayTo!)}`;
    throw new PromoError(`That code is for check-ins ${range}.`);
  }
  if (p.maxUses !== null) {
    const [{ used }] = await query<{ used: string }>(
      "SELECT count(*) AS used FROM bookings WHERE promo_code = $1 AND status = 'confirmed'",
      [code],
    );
    if (Number(used) >= p.maxUses) throw new PromoError("That promo code has reached its limit.");
  }
  return { code: p.code, percent: p.guestPercent, commissionPercent: p.commissionPercent };
}

// ---------- Admin ----------

function dateOrNull(v: unknown, label: string): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new PromoError(`${label}: use a valid date.`);
  return s;
}

function percent(v: unknown, label: string, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new PromoError(`${label} must be between 0 and ${max}%.`);
  return Math.round(n * 100) / 100;
}

export function parsePromoInput(raw: unknown) {
  const b = (raw ?? {}) as Record<string, unknown>;
  const code = normalizeCode(String(b.code ?? ""));
  if (!CODE_RE.test(code)) throw new PromoError("Code: 3 to 24 letters or numbers (dashes allowed), e.g. MARIA5.");
  const influencer = String(b.influencer ?? "").trim().slice(0, 80);
  if (!influencer) throw new PromoError("Enter the influencer's name.");
  const input = {
    code,
    influencer,
    contact: String(b.contact ?? "").trim().slice(0, 160),
    guestPercent: percent(b.guestPercent, "Guest discount", 50),
    commissionPercent: percent(b.commissionPercent, "Commission", 50),
    redeemFrom: dateOrNull(b.redeemFrom, "Usable from"),
    redeemTo: dateOrNull(b.redeemTo, "Usable until"),
    stayFrom: dateOrNull(b.stayFrom, "Check-ins from"),
    stayTo: dateOrNull(b.stayTo, "Check-ins until"),
    maxUses: b.maxUses === "" || b.maxUses === null || b.maxUses === undefined ? null : Math.round(Number(b.maxUses)),
    active: b.active !== false,
  };
  if (input.maxUses !== null && (!Number.isFinite(input.maxUses) || input.maxUses < 1)) {
    throw new PromoError("Max uses must be 1 or more, or empty for no limit.");
  }
  if (input.redeemFrom && input.redeemTo && input.redeemFrom > input.redeemTo) {
    throw new PromoError("'Usable until' must be after 'Usable from'.");
  }
  if (input.stayFrom && input.stayTo && input.stayFrom > input.stayTo) {
    throw new PromoError("'Check-ins until' must be after 'Check-ins from'.");
  }
  return input;
}

export async function createPromo(raw: unknown): Promise<Promo> {
  const p = parsePromoInput(raw);
  const rows = await query<Row>(
    `INSERT INTO promo_codes (code, influencer, contact, guest_percent, commission_percent,
       redeem_from, redeem_to, stay_from, stay_to, max_uses, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (code) DO NOTHING RETURNING ${COLS}`,
    [p.code, p.influencer, p.contact, p.guestPercent, p.commissionPercent, p.redeemFrom, p.redeemTo, p.stayFrom, p.stayTo, p.maxUses, p.active],
  );
  if (!rows[0]) throw new PromoError(`The code ${p.code} already exists.`);
  return toPromo(rows[0]);
}

/** Update everything except the code itself (it may already be printed in posts). */
export async function updatePromo(id: string, raw: unknown): Promise<Promo> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new PromoError("Unknown code.");
  const p = parsePromoInput(raw);
  const rows = await query<Row>(
    `UPDATE promo_codes SET influencer = $2, contact = $3, guest_percent = $4, commission_percent = $5,
       redeem_from = $6, redeem_to = $7, stay_from = $8, stay_to = $9, max_uses = $10, active = $11
     WHERE id = $1 RETURNING ${COLS}`,
    [id, p.influencer, p.contact, p.guestPercent, p.commissionPercent, p.redeemFrom, p.redeemTo, p.stayFrom, p.stayTo, p.maxUses, p.active],
  );
  if (!rows[0]) throw new PromoError("Unknown code.");
  return toPromo(rows[0]);
}

export type PromoStats = Promo & { bookings: number; sales: number; commission: number };

/**
 * Every code with its results. Sales = price before taxes of the stays,
 * reduced by any refunds; commission is the code's % of that.
 */
export async function listPromos(): Promise<PromoStats[]> {
  const rows = await query<Row & { bookings: string; sales: string | null; commission: string | null }>(
    `WITH b AS (
       SELECT promo_code,
              (quote->>'subtotal')::numeric
                * GREATEST(0, LEAST(1, (total_cents - refunded_cents)::numeric / NULLIF(total_cents, 0))) AS kept,
              commission_percent, status
       FROM bookings WHERE promo_code IS NOT NULL
     )
     SELECT p.id, p.code, p.influencer, p.contact, p.guest_percent, p.commission_percent,
       to_char(p.redeem_from, 'YYYY-MM-DD') AS redeem_from, to_char(p.redeem_to, 'YYYY-MM-DD') AS redeem_to,
       to_char(p.stay_from, 'YYYY-MM-DD') AS stay_from, to_char(p.stay_to, 'YYYY-MM-DD') AS stay_to,
       p.max_uses, p.active, p.created_at,
       count(b.promo_code) FILTER (WHERE b.status = 'confirmed') AS bookings,
       round(sum(b.kept)) AS sales,
       round(sum(b.kept * b.commission_percent / 100)) AS commission
     FROM promo_codes p LEFT JOIN b ON b.promo_code = p.code
     GROUP BY p.id ORDER BY p.created_at DESC`,
  );
  return rows.map((r) => ({
    ...toPromo(r),
    bookings: Number(r.bookings),
    sales: Number(r.sales ?? 0),
    commission: Number(r.commission ?? 0),
  }));
}
