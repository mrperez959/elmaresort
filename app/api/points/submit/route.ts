import { currentUser } from "@/lib/auth";
import { submitPost, PointsError } from "@/lib/points";
import { allow } from "@/lib/ratelimit";
import { readJson, fail } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = await readJson(req);
  if (b instanceof Response) return b;
  const user = await currentUser();
  if (!user?.emailVerified) return fail("Sign in again.", 401);
  if (b.disclosed !== true) return fail("Please confirm the post tags @elmaresort and says you got points for it.");
  if (!(await allow(`points-submit:${user.id}`, 10, 3600))) return fail("Too many requests. Wait a moment.", 429);
  try {
    await submitPost(user.id, String(b.url ?? "").slice(0, 300));
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof PointsError) return fail(err.message);
    console.error("[points/submit]", err);
    return fail("Something went wrong. Try again.", 500);
  }
}
