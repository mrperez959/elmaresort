import { currentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { parseStayRequest, QuoteError } from "@/lib/quote";
import { readJson } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

/** Remembers the last stay a signed-in guest looked at in checkout, for the "still available" email. */
export async function POST(req: Request) {
  const body = await readJson(req);
  if (body instanceof Response) return body;
  const user = await currentUser();
  if (!user?.emailVerified) return new Response(null, { status: 204 });
  try {
    const stay = parseStayRequest(body);
    const total = Math.max(0, Math.round(Number(body.total) || 0));
    await query(
      `INSERT INTO checkout_intents (user_id, stay, total_cents, updated_at, emailed_at)
       VALUES ($1, $2, $3, now(), NULL)
       ON CONFLICT (user_id) DO UPDATE SET stay = EXCLUDED.stay, total_cents = EXCLUDED.total_cents,
         updated_at = now(),
         emailed_at = CASE WHEN checkout_intents.stay = EXCLUDED.stay THEN checkout_intents.emailed_at ELSE NULL END`,
      [user.id, JSON.stringify(stay), total],
    );
  } catch (err) {
    if (!(err instanceof QuoteError)) console.error("[checkout-intent]", err);
  }
  return new Response(null, { status: 204 });
}
