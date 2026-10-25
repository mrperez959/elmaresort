import { isAdmin } from "@/lib/auth";
import { adjustPoints, approvePost, PointsError, rejectPost } from "@/lib/points";
import { getSettings, saveSettings, SettingsError, validateSettings } from "@/lib/settings";
import { readJson, fail } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

const int = (v: unknown) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Elma Points admin actions: approve, reject, adjust, rules. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return fail("Sign in as admin.", 401);
  const b = await readJson(req);
  if (b instanceof Response) return b;
  try {
    switch (b.action) {
      case "approve": {
        const likes = int(b.likes);
        const comments = int(b.comments);
        if (likes === null || comments === null) return fail("Enter the likes and comments.");
        const override = b.points === "" || b.points === null || b.points === undefined ? null : int(b.points);
        if (b.points !== "" && b.points !== null && b.points !== undefined && override === null)
          return fail("Points must be 0 or more.");
        const r = await approvePost(String(b.id), likes, comments, override);
        return Response.json({ ok: true, points: r.points });
      }
      case "reject":
        await rejectPost(String(b.id), String(b.note ?? ""));
        return Response.json({ ok: true });
      case "adjust":
        await adjustPoints(String(b.email ?? ""), Number(b.points), String(b.note ?? ""));
        return Response.json({ ok: true });
      case "rules": {
        const current = await getSettings();
        const next = validateSettings({ ...current, loyalty: b.loyalty });
        await saveSettings(next);
        return Response.json({ ok: true, loyalty: next.loyalty });
      }
      default:
        return fail("Unknown action.");
    }
  } catch (err) {
    if (err instanceof PointsError || err instanceof SettingsError) return fail(err.message);
    console.error("[admin/points]", err);
    return fail("Something went wrong. Try again.", 500);
  }
}
