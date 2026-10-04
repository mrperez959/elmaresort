import { currentUser } from "@/lib/auth";
import { markEmailVerified } from "@/lib/users";
import { checkCode, CodeError } from "@/lib/codes";
import { readJson, fail } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = await readJson(req);
  if (b instanceof Response) return b;
  const user = await currentUser();
  if (!user) return fail("Sign in again to verify your email.", 401);
  if (user.emailVerified) return Response.json({ ok: true });
  try {
    if (!(await checkCode(user.email, "verify", String(b.code ?? "")))) {
      return fail("That code isn't right. Check the email and try again.");
    }
    await markEmailVerified(user.id);
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof CodeError) return fail(err.message);
    console.error("[verify]", err);
    return fail("Verification isn't working right now. Try again.", 500);
  }
}
