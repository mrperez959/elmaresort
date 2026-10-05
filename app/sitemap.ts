import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const base = host ? `https://${host}` : "http://localhost:3000";
  return ["", "/house-rules", "/rental-agreement", "/refunds", "/privacy"].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: p ? "monthly" : "weekly",
    priority: p ? 0.3 : 1,
  }));
}
