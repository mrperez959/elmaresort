import { getSettings } from "@/lib/settings";
import { aboutHome, faqs, NEARBY } from "@/lib/content";
import { AMENITIES, HOUSE_AMENITIES } from "@/lib/property";

export const dynamic = "force-dynamic";

/**
 * /llms.txt: a plain-text summary for AI assistants (a growing convention).
 * Built from the same content as the home page, so it never goes out of date.
 */
export async function GET() {
  const s = await getSettings();
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const base = host ? `https://${host}` : "";
  const name = process.env.NEXT_PUBLIC_PROPERTY_NAME ?? "Elma Resort";
  const text = [
    `# ${name}`,
    "",
    `> Waterfront vacation rental in Tampa, Florida (Town 'n' Country area). Book directly at ${base || "this website"}.`,
    "",
    ...aboutHome("en", s),
    "",
    "## Highlights",
    ...AMENITIES.map((a) => `- ${a.title}: ${a.detail ?? ""}`),
    "",
    "## Amenities",
    ...HOUSE_AMENITIES.map((a) => `- ${a.title}${a.detail ? ` (${a.detail})` : ""}`),
    "",
    "## Nearby (approximate drive times)",
    ...NEARBY.map((n) => `- ${n.en}: ${n.minutes} min`),
    "",
    "## FAQ",
    ...faqs("en", s).flatMap((f) => [`### ${f.q}`, f.a, ""]),
    "## Links",
    `- [Book and see availability](${base}/)`,
    `- [Reservar en español](${base}/es)`,
    `- [House rules](${base}/house-rules)`,
    `- [Cancellation and refunds](${base}/refunds)`,
    "",
  ].join("\n");
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
