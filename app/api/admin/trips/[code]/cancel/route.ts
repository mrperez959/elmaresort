import { isAdmin, isJsonRequest } from "@/lib/auth";
import { cancelTrip, getTrip, TripError } from "@/lib/trips";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!(await isAdmin())) return Response.json({ error: "Sign in as admin." }, { status: 401 });
  if (!isJsonRequest(req)) return Response.json({ error: "Unsupported request." }, { status: 415 });
  const { code } = await params;
  const trip = await getTrip(code, null);
  if (!trip) return Response.json({ error: "Booking not found." }, { status: 404 });
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  try {
    return Response.json({ ok: true, ...(await cancelTrip(trip, { full: body.full === true })) });
  } catch (err) {
    if (err instanceof TripError) return Response.json({ error: err.message }, { status: 409 });
    console.error(`[admin cancel] ${code}`, err);
    return Response.json({ error: "The booking couldn't be cancelled." }, { status: 502 });
  }
}
