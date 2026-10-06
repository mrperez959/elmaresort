import localFont from "next/font/local";

// Both faces are self-hosted (no request to Google, no layout jump while
// loading): Next.js generates size-adjusted fallbacks so text doesn't reflow
// when the real font arrives. Licenses (SIL OFL) are next to the files.

/** Display: headings only. A high-contrast serif that echoes the "ELMA" wordmark. */
export const display = localFont({
  src: [
    { path: "./fonts/cormorant-garamond-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/cormorant-garamond-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
  fallback: ["Iowan Old Style", "Georgia", "serif"],
  adjustFontFallback: "Times New Roman",
});

/** Body: everything else. Designed for legibility at small sizes and for low vision. */
export const body = localFont({
  src: [
    { path: "./fonts/atkinson-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/atkinson-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/atkinson-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-body",
  display: "swap",
  fallback: ["Segoe UI", "Roboto", "system-ui", "sans-serif"],
  adjustFontFallback: "Arial",
});
