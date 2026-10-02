import {
  clearAttempts,
  clientKey,
  isJsonRequest,
  recordFailedAttempt,
  startGuestSession,
  tooManyAttempts,
  verifyPassword,
} from "@/lib/auth";
import { findUserWithHash } from "@/lib/users";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(req: Request) {
  if (!isJsonRequest(req)) return fail("Unsupported request.", 415);
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const email = String(b.email ?? "").trim();
  const password = String(b.password ?? "");
  const key = clientKey(req, email);

  if (tooManyAttempts(key)) return fail("Too many attempts. Wait 15 minutes and try again.", 429);
  try {
    const found = await findUserWithHash(email);
    const ok = found ? await verifyPassword(password, found.passwordHash) : false;
    if (!found || !ok) {
      recordFailedAttempt(key);
      return fail("That email and password don't match.", 401);
    }
    clearAttempts(key);
    await startGuestSession(found.user.id);
    return Response.json({ user: found.user });
  } catch (err) {
    console.error("[login]", err);
    return fail("Sign-in isn't working right now. Try again.", 500);
  }
}
