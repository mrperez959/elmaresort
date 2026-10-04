import { findUserWithHash } from "@/lib/users";
import { sendCode, CodeError } from "@/lib/codes";
import { clientIp } from "@/lib/ratelimit";
import { readJson, fail, EMAIL } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

// Always answers the same way, so nobody can test which emails have accounts.
export async function POST(req: Request) {
  const b = await readJson(req);
  if (b instanceof Response) return b;
  const email = String(b.email ?? "").trim().slice(0, 200);
  if (!EMAIL.test(email)) return fail("Enter a valid email address.");
  try {
    if (await findUserWithHash(email)) await sendCode(email, "reset", clientIp(req));
  } catch (err) {
    if (err instanceof CodeError) return fail(err.message, 429);
    console.error("[reset/request]", err);
  }
  return Response.json({ ok: true });
}
