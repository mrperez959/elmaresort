import { parseStayRequest, quoteStayWithPromo, QuoteError } from "@/lib/quote";
import { allow, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await allow(`quote:${clientIp(req)}`, 120, 60))) {
    return Response.json({ error: "Too many requests. Wait a moment." }, { status: 429 });
  }
  try {
    const stay = parseStayRequest(await req.json().catch(() => null));
    // "soft": a bad promo code doesn't block the price; the guest sees why it didn't apply.
    const { quote, promoError } = await quoteStayWithPromo(stay, { promoMode: "soft" });
    return Response.json({ quote, promoError });
  } catch (err) {
    if (err instanceof QuoteError) {
      return Response.json({ error: err.message, code: err.code }, { status: 409 });
    }
    console.error("[quote]", err);
    return Response.json({ error: "The price couldn't be calculated. Try again." }, { status: 502 });
  }
}
