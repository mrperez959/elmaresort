import type { MetadataRoute } from "next";

// Built per request so it always uses the current production domain.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/checkout", "/api/", "/calendar/", "/es/account", "/es/checkout"] }],
    ...(host ? { sitemap: `https://${host}/sitemap.xml` } : {}),
  };
}
