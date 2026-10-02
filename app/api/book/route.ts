import { bookStay } from "@/lib/booking";
import { parseStayRequest, QuoteError } from "@/lib/quote";
import { currentUser, isJsonRequest } from "@/lib/auth";
import type { BookResult } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const reply = (body: BookResult, status: number) => Response.json(body, { status });

export async function POST(req: Request) {
  if (!isJsonRequest(req)) return reply({ state: "error", message: "Unsupported request." }, 415);
  try {
    const guest = await currentUser();
    if (!guest) {
      return reply({ state: "signin_required", message: "Sign in or create an account to book." }, 401);
    }
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const stay = parseStayRequest(body);
    const sourceId = String(body?.sourceId ?? "");
    const idempotencyKey = String(body?.idempotencyKey ?? "");
    const expectedTotal = Number(body?.expectedTotal);
    if (!sourceId || !/^[\w-]{16,64}$/.test(idempotencyKey) || !Number.isInteger(expectedTotal)) {
      return reply({ state: "error", message: "Payment details are missing. Try again." }, 400);
    }

    const result = await bookStay({ stay, guest, sourceId, idempotencyKey, expectedTotal });
    return reply(result, result.state === "confirmed" ? 200 : 409);
  } catch (err) {
    if (err instanceof QuoteError) return reply({ state: "error", message: err.message }, 400);
    console.error("[book]", err);
    return reply(
      {
        state: "error",
        message: "Something went wrong on our side and your card was not charged. Please try again in a minute.",
      },
      502,
    );
  }
}
