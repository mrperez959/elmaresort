import { withGuestTrip } from "@/lib/trip-api";
import { previewChange } from "@/lib/trips";
import { parseStayRequest } from "@/lib/quote";

export const dynamic = "force-dynamic";

export function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  return withGuestTrip(req, params, (trip, body) => previewChange(trip, parseStayRequest(body)));
}
