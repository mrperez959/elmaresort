import { parseStayRequest, quoteStay, QuoteError } from "@/lib/quote";
import { allow, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await allow(`quote:${clientIp(req)}`, 120, 60))) {
    return Response.json({ error: "Too many requests. Wait a moment." }, { status: 429 });
  }
  try {
    const stay = parseStayRequest(await req.json().catch(() => null));
    const quote = await quoteStay(stay);
    return Response.json({ quote });
  } catch (err) {
    if (err instanceof QuoteError) {
      return Response.json({ error: err.message, code: err.code }, { status: 409 });
    }
    console.error("[quote]", err);
    return Response.json({ error: "The price couldn't be calculated. Try again." }, { status: 502 });
  }
}
