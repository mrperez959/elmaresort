import type { NextConfig } from "next";

// Security headers on every response. They don't restrict scripts, so the
// Square payment form (and its 3-D Secure bank pop-ups) keeps working.
const securityHeaders = [
  // Always HTTPS, for two years, including subdomains.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Nobody can show the site inside their own page (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), usb=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Private pages must never be cached by a browser or CDN.
      {
        source: "/(account|admin|checkout)(.*)",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      { source: "/admin(.*)", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
