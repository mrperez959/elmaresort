import { isAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { readJson, fail } from "@/lib/route-helpers";
import { isISODate } from "@/lib/dates";
import { normalizeCode } from "@/lib/promos";

export const dynamic = "force-dynamic";

/** Record a commission payment to an influencer. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return fail("Sign in as admin.", 401);
  const b = await readJson(req);
  if (b instanceof Response) return b;
  const code = normalizeCode(String(b.code ?? ""));
  const amount = Math.round(Number(b.amount) * 100);
  const paidOn = String(b.paidOn ?? "");
  if (!Number.isFinite(amount) || amount <= 0) return fail("Enter the amount paid.");
  if (!isISODate(paidOn)) return fail("Pick the date it was paid.");
  const note = String(b.note ?? "").trim().slice(0, 160);
  const rows = await query<{ id: string }>(
    `INSERT INTO promo_payouts (code, amount_cents, paid_on, note)
     SELECT code, $2, $3, $4 FROM promo_codes WHERE code = $1 RETURNING id`,
    [code, amount, paidOn, note],
  );
  if (!rows[0]) return fail("Unknown code.");
  return Response.json({ ok: true });
}
