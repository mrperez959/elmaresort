import { endGuestSession } from "@/lib/auth";

export async function POST() {
  await endGuestSession();
  return Response.json({ ok: true });
}
