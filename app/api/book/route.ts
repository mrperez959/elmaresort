import { bookStay } from "@/lib/booking";
import { parseStayRequest, QuoteError } from "@/lib/quote";
import type { BookResult, GuestDetails } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseGuest(raw: unknown): GuestDetails {
  const g = (raw ?? {}) as Record<string, unknown>;
  const guest = {
    firstName: String(g.firstName ?? "").trim().slice(0, 80),
    lastName: String(g.lastName ?? "").trim().slice(0, 80),
    email: String(g.email ?? "").trim().slice(0, 200),
    phone: String(g.phone ?? "").trim().slice(0, 40),
  };
  if (!guest.firstName || !guest.lastName) {
    throw new QuoteError("invalid", "Enter the first and last name of the person booking.");
  }
  if (!EMAIL.test(guest.email)) throw new QuoteError("invalid", "Enter a valid email address.");
  return guest;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const stay = parseStayRequest(body);
    const guest = parseGuest(body?.guest);
    const sourceId = String(body?.sourceId ?? "");
    const idempotencyKey = String(body?.idempotencyKey ?? "");
    const expectedTotal = Number(body?.expectedTotal);
    if (!sourceId || !/^[\w-]{16,64}$/.test(idempotencyKey) || !Number.isInteger(expectedTotal)) {
      return Response.json({ state: "error", message: "Payment details are missing. Try again." } satisfies BookResult, {
        status: 400,
      });
    }

    const result = await bookStay({ stay, guest, sourceId, idempotencyKey, expectedTotal });
    return Response.json(result, { status: result.state === "confirmed" ? 200 : 409 });
  } catch (err) {
    if (err instanceof QuoteError) {
      return Response.json({ state: "error", message: err.message } satisfies BookResult, { status: 400 });
    }
    console.error("[book]", err);
    return Response.json(
      {
        state: "error",
        message: "Something went wrong on our side and your card was not charged. Please try again in a minute.",
      } satisfies BookResult,
      { status: 502 },
    );
  }
}
