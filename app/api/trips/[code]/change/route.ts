import { withGuestTrip } from "@/lib/trip-api";
import { applyChange } from "@/lib/trips";
import { parseStayRequest } from "@/lib/quote";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  return withGuestTrip(req, params, async (trip, body) => {
    const sourceId = typeof body.sourceId === "string" ? body.sourceId : "";
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
    const preview = await applyChange(
      trip,
      parseStayRequest(body),
      Number(body.expectedDifference),
      sourceId && /^[\w-]{16,64}$/.test(idempotencyKey) ? { sourceId, idempotencyKey } : undefined,
    );
    return { ok: true, preview };
  });
}
