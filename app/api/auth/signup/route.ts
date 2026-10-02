import { hashPassword, isJsonRequest, startGuestSession } from "@/lib/auth";
import { createUser } from "@/lib/users";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fail = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(req: Request) {
  if (!isJsonRequest(req)) return fail("Unsupported request.", 415);
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const firstName = String(b.firstName ?? "").trim().slice(0, 80);
  const lastName = String(b.lastName ?? "").trim().slice(0, 80);
  const email = String(b.email ?? "").trim().slice(0, 200);
  const phone = String(b.phone ?? "").trim().slice(0, 40);
  const password = String(b.password ?? "");

  if (!firstName || !lastName) return fail("Enter your first and last name.");
  if (!EMAIL.test(email)) return fail("Enter a valid email address.");
  if (phone.replace(/\D/g, "").length < 7) return fail("Enter a phone number so we can reach you about your stay.");
  if (password.length < 8 || password.length > 200) return fail("Use a password of at least 8 characters.");

  try {
    const user = await createUser({ email, firstName, lastName, phone, passwordHash: await hashPassword(password) });
    if (!user) return fail("There's already an account with that email. Sign in instead.", 409);
    await startGuestSession(user.id);
    return Response.json({ user });
  } catch (err) {
    console.error("[signup]", err);
    return fail("Your account couldn't be created. Try again.", 500);
  }
}
