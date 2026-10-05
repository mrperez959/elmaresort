import { startGuestSession, verifyPassword } from "@/lib/auth";
import { findUserWithHash } from "@/lib/users";
import { sendCode, CodeError } from "@/lib/codes";
import { allow, reset, clientIp } from "@/lib/ratelimit";
import { readJson, fail } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = await readJson(req);
  if (b instanceof Response) return b;
  const email = String(b.email ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(b.password ?? "");
  const ip = clientIp(req);

  if (!(await allow(`login-ip:${ip}`, 30, 900)) || !(await allow(`login:${email}`, 8, 900))) {
    return fail("Too many attempts. Wait 15 minutes and try again.", 429);
  }
  try {
    const found = await findUserWithHash(email);
    const ok = found ? await verifyPassword(password, found.passwordHash) : false;
    if (!found || !ok) {
      await new Promise((r) => setTimeout(r, 400));
      return fail("That email and password don't match.", 401);
    }
    await reset(`login:${email}`);
    await startGuestSession(found.user.id, found.sessionVersion);
    if (!found.user.emailVerified) {
      await sendCode(found.user.email, "verify", ip, found.user.lang).catch((e) => {
        if (!(e instanceof CodeError)) throw e; // a recent code is still valid
      });
      return Response.json({ ok: true, needsVerification: true });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[login]", err);
    return fail("Sign-in isn't working right now. Try again.", 500);
  }
}
