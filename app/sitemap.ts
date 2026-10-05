import type { MetadataRoute } from "next";

// Built per request so it always uses the current production domain.
export const dynamic = "force-dynamic";

const PAGES = ["/", "/house-rules", "/rental-agreement", "/refunds", "/privacy"];

export default function sitemap(): MetadataRoute.Sitemap {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const base = host ? `https://${host}` : "http://localhost:3000";
  const es = (p: string) => (p === "/" ? "/es" : `/es${p}`);
  return PAGES.flatMap((p) => {
    const languages = { "en-US": `${base}${p === "/" ? "" : p}`, "es-US": `${base}${es(p)}` };
    const common = {
      changeFrequency: (p === "/" ? "weekly" : "monthly") as "weekly" | "monthly",
      priority: p === "/" ? 1 : 0.3,
      alternates: { languages },
    };
    return [
      { url: languages["en-US"], ...common },
      { url: languages["es-US"], ...common, priority: p === "/" ? 0.9 : 0.3 },
    ];
  });
}
