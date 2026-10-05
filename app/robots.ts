import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/checkout", "/api/", "/calendar/"] }],
    ...(host ? { sitemap: `https://${host}/sitemap.xml` } : {}),
  };
}
