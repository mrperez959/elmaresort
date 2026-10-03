import { withGuestTrip } from "@/lib/trip-api";
import { cancelTrip } from "@/lib/trips";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  return withGuestTrip(req, params, async (trip) => ({ ok: true, ...(await cancelTrip(trip)) }));
}
