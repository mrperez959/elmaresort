import { currentUser } from "@/lib/auth";
import { sendCode, CodeError } from "@/lib/codes";
import { clientIp } from "@/lib/ratelimit";
import { readJson, fail } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = await readJson(req);
  if (b instanceof Response) return b;
  const user = await currentUser();
  if (!user) return fail("Sign in again.", 401);
  if (user.emailVerified) return Response.json({ ok: true });
  try {
    await sendCode(user.email, "verify", clientIp(req), user.lang);
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof CodeError) return fail(err.message, 429);
    console.error("[resend]", err);
    return fail("The code couldn't be sent. Try again in a minute.", 500);
  }
}
