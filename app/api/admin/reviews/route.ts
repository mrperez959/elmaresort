import { isAdmin, isJsonRequest } from "@/lib/auth";
import { addReview, deleteReview, ReviewError } from "@/lib/reviews";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Sign in as admin." }, { status: 401 });
  if (!isJsonRequest(req)) return Response.json({ error: "Unsupported request." }, { status: 415 });
  try {
    return Response.json({ review: await addReview(await req.json()) });
  } catch (err) {
    if (err instanceof ReviewError) return Response.json({ error: err.message }, { status: 400 });
    console.error("[admin/reviews]", err);
    return Response.json({ error: "The review couldn't be saved." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Sign in as admin." }, { status: 401 });
  await deleteReview(new URL(req.url).searchParams.get("id") ?? "");
  return Response.json({ ok: true });
}
