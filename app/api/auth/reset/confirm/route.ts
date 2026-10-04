import { hashPassword, startGuestSession } from "@/lib/auth";
import { findUserWithHash, setPassword } from "@/lib/users";
import { checkCode, CodeError } from "@/lib/codes";
import { readJson, fail, passwordProblem } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = await readJson(req);
  if (b instanceof Response) return b;
  const email = String(b.email ?? "").trim().slice(0, 200);
  const password = String(b.password ?? "");
  const weak = passwordProblem(password, email);
  if (weak) return fail(weak);
  try {
    const found = await findUserWithHash(email);
    if (!found || !(await checkCode(email, "reset", String(b.code ?? "")))) {
      return fail("That code isn't right. Check the email and try again.");
    }
    const version = await setPassword(found.user.id, await hashPassword(password));
    await startGuestSession(found.user.id, version);
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof CodeError) return fail(err.message);
    console.error("[reset/confirm]", err);
    return fail("Your password couldn't be changed. Try again.", 500);
  }
}
