import { recordEvents, pruneOld } from "@/lib/analytics";
import { currentUser, isAdmin, isJsonRequest } from "@/lib/auth";
import { allow, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const ok = () => new Response(null, { status: 204 });

export async function POST(req: Request) {
  try {
    if (!isJsonRequest(req)) return ok();
    if (/bot|crawl|spider|headless|lighthouse|preview/i.test(req.headers.get("user-agent") ?? "")) return ok();
    if (await isAdmin()) return ok(); // don't count the owner
    if (!(await allow(`t:${clientIp(req)}`, 120, 60))) return ok();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return ok();
    const user = await currentUser().catch(() => null);
    await recordEvents(req, body as Record<string, unknown>, user?.id ?? null);
    await pruneOld();
  } catch (err) {
    console.error("[analytics]", err);
  }
  return ok();
}
