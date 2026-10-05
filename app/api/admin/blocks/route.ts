import { isAdmin } from "@/lib/auth";
import { query, OVERLAP_ERROR } from "@/lib/db";
import { readJson, fail } from "@/lib/route-helpers";
import { isISODate } from "@/lib/dates";
import { clearFeedCache } from "@/lib/ical";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await isAdmin())) return fail("Sign in as admin.", 401);
  const b = await readJson(req);
  if (b instanceof Response) return b;
  const start = String(b.start ?? "");
  const end = String(b.end ?? "");
  if (!isISODate(start) || !isISODate(end) || end <= start) return fail("Pick a first night and a later end date.");
  const note = String(b.note ?? "").trim().slice(0, 120);
  // Don't block over a paid direct booking by mistake.
  const clash = await query<{ code: string }>(
    `SELECT code FROM bookings WHERE status = 'confirmed' AND daterange(check_in, check_out) && daterange($1::date, $2::date) LIMIT 1`,
    [start, end],
  );
  if (clash[0]) return fail(`Those dates overlap direct booking ${clash[0].code}.`);
  try {
    await query("INSERT INTO owner_blocks (start_date, end_date, note) VALUES ($1, $2, $3)", [start, end, note]);
  } catch (err) {
    if ((err as { code?: string }).code === OVERLAP_ERROR) return fail("Those dates overlap.");
    throw err;
  }
  clearFeedCache();
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return fail("Sign in as admin.", 401);
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Unknown block.");
  await query("DELETE FROM owner_blocks WHERE id = $1", [id]);
  return Response.json({ ok: true });
}
