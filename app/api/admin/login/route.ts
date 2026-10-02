import {
  adminPasswordMatches,
  clearAttempts,
  clientKey,
  isJsonRequest,
  recordFailedAttempt,
  startAdminSession,
  tooManyAttempts,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isJsonRequest(req)) return Response.json({ error: "Unsupported request." }, { status: 415 });
  const key = clientKey(req, "admin");
  if (tooManyAttempts(key)) {
    return Response.json({ error: "Too many attempts. Wait 15 minutes and try again." }, { status: 429 });
  }
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  if (!adminPasswordMatches(String(b.password ?? ""))) {
    recordFailedAttempt(key);
    await new Promise((r) => setTimeout(r, 800));
    return Response.json({ error: "Wrong password." }, { status: 401 });
  }
  clearAttempts(key);
  await startAdminSession();
  return Response.json({ ok: true });
}
