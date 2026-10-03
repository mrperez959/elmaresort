import "server-only";
import { currentUser, isJsonRequest } from "./auth";
import { getTrip, TripError, type Trip } from "./trips";
import { QuoteError } from "./quote";

/** Shared plumbing for /api/trips/[code]/*: auth, ownership and error mapping. */
export async function withGuestTrip(
  req: Request,
  params: Promise<{ code: string }>,
  fn: (trip: Trip, body: Record<string, unknown>) => Promise<unknown>,
): Promise<Response> {
  if (!isJsonRequest(req)) return Response.json({ error: "Unsupported request." }, { status: 415 });
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sign in again to manage your trip." }, { status: 401 });
  const { code } = await params;
  const trip = await getTrip(code, user.id);
  if (!trip) return Response.json({ error: "Trip not found." }, { status: 404 });
  try {
    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    return Response.json(await fn(trip, body));
  } catch (err) {
    if (err instanceof TripError || err instanceof QuoteError) {
      return Response.json({ error: err.message }, { status: 409 });
    }
    console.error(`[trips] ${code}`, err);
    return Response.json({ error: "Something went wrong. Nothing was charged. Try again or contact us." }, { status: 502 });
  }
}
