import { adminPending, startAdminSession } from "@/lib/auth";
import { checkCode, CodeError } from "@/lib/codes";
import { readJson, fail } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = await readJson(req);
  if (b instanceof Response) return b;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || !(await adminPending())) return fail("Start again with your password.", 401);
  try {
    if (!(await checkCode(adminEmail, "admin", String(b.code ?? "")))) return fail("That code isn't right.");
    await startAdminSession();
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof CodeError) return fail(err.message);
    console.error("[admin/verify]", err);
    return fail("Verification isn't working right now.", 500);
  }
}
