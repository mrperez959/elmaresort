import { currentUser } from "@/lib/auth";
import { transferPoints, PointsError } from "@/lib/points";
import { allow } from "@/lib/ratelimit";
import { readJson, fail } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = await readJson(req);
  if (b instanceof Response) return b;
  const user = await currentUser();
  if (!user?.emailVerified) return fail("Sign in again.", 401);
  if (!(await allow(`points-transfer:${user.id}`, 10, 3600))) return fail("Too many requests. Wait a moment.", 429);
  try {
    const { recipientName } = await transferPoints(user, String(b.email ?? "").slice(0, 200), Number(b.points));
    return Response.json({ ok: true, recipientName });
  } catch (err) {
    if (err instanceof PointsError) return fail(err.message);
    console.error("[points/transfer]", err);
    return fail("Something went wrong. Try again.", 500);
  }
}
