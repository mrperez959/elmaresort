// Apple Pay domain verification. Square gives you this file when you add your
// domain under Apple Pay in the Developer Console; paste its contents into the
// APPLE_PAY_DOMAIN_ASSOCIATION environment variable.
export const dynamic = "force-dynamic";

export function GET() {
  const body = process.env.APPLE_PAY_DOMAIN_ASSOCIATION;
  if (!body) return new Response("Not configured", { status: 404 });
  return new Response(body, { headers: { "Content-Type": "text/plain" } });
}
