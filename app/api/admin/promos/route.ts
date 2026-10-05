import { isAdmin } from "@/lib/auth";
import { createPromo, updatePromo, listPromos, PromoError } from "@/lib/promos";
import { readJson, fail } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

async function guard() {
  return (await isAdmin()) ? null : fail("Sign in as admin.", 401);
}

export async function GET() {
  return (await guard()) ?? Response.json({ promos: await listPromos() });
}

export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const body = await readJson(req);
  if (body instanceof Response) return body;
  try {
    return Response.json({ promo: await createPromo(body) });
  } catch (err) {
    if (err instanceof PromoError) return fail(err.message);
    console.error("[admin/promos]", err);
    return fail("The code couldn't be saved.", 500);
  }
}

export async function PUT(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const body = await readJson(req);
  if (body instanceof Response) return body;
  try {
    return Response.json({ promo: await updatePromo(String(body.id ?? ""), body) });
  } catch (err) {
    if (err instanceof PromoError) return fail(err.message);
    console.error("[admin/promos]", err);
    return fail("The code couldn't be saved.", 500);
  }
}
