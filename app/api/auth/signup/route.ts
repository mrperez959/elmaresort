import { hashPassword, startGuestSession } from "@/lib/auth";
import { createUser, normalizePhone } from "@/lib/users";
import { sendCode, CodeError } from "@/lib/codes";
import { allow, clientIp } from "@/lib/ratelimit";
import { readJson, fail, EMAIL, passwordProblem } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = await readJson(req);
  if (b instanceof Response) return b;
  // Honeypot: real people never fill this hidden field.
  if (String(b.website ?? "")) return Response.json({ ok: true, needsVerification: true });

  const ip = clientIp(req);
  if (!(await allow(`signup:${ip}`, 5, 3600))) return fail("Too many accounts created from here. Try again later.", 429);

  const firstName = String(b.firstName ?? "").trim().slice(0, 80);
  const lastName = String(b.lastName ?? "").trim().slice(0, 80);
  const email = String(b.email ?? "").trim().slice(0, 200);
  const phone = normalizePhone(String(b.phone ?? ""));
  const password = String(b.password ?? "");

  if (!firstName || !lastName) return fail("Enter your first and last name.");
  if (!EMAIL.test(email)) return fail("Enter a valid email address.");
  if (!phone) return fail("Enter a valid mobile number. Include the country code if it's not a US number (e.g. +44…).");
  const weak = passwordProblem(password, email);
  if (weak) return fail(weak);

  try {
    const user = await createUser({ email, firstName, lastName, phone, passwordHash: await hashPassword(password) });
    if (!user) return fail("There's already an account with that email. Sign in instead.", 409);
    await startGuestSession(user.id, 1);
    await sendCode(user.email, "verify", ip);
    return Response.json({ ok: true, needsVerification: true });
  } catch (err) {
    if (err instanceof CodeError) return fail(err.message, 429);
    console.error("[signup]", err);
    return fail("Your account couldn't be created. Try again.", 500);
  }
}
