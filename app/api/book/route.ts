import { bookStay } from "@/lib/booking";
import { parseStayRequest, QuoteError } from "@/lib/quote";
import { currentUser, isJsonRequest } from "@/lib/auth";
import { allow, clientIp } from "@/lib/ratelimit";
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
    if (!guest.emailVerified) {
      return reply({ state: "signin_required", message: "Confirm your email with the code we sent before booking." }, 403);
    }
    // Stops "card testing" (trying many stolen cards through the payment form).
    if (!(await allow(`book-user:${guest.id}`, 6, 3600)) || !(await allow(`book-ip:${clientIp(req)}`, 15, 3600))) {
      return reply({ state: "error", message: "Too many payment attempts. Please wait an hour or contact us." }, 429);
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
    // Log the provider's own error details (Square puts them in `errors`).
    const details = (err as { errors?: unknown; statusCode?: number }) ?? {};
    console.error("[book] failed", details.statusCode ?? "", JSON.stringify(details.errors ?? null), err);
    return reply(
      {
        state: "error",
        message: "Something went wrong on our side and your card was not charged. Please try again in a minute.",
      },
      502,
    );
  }
}
