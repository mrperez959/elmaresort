"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

/** Google Ads tag (gtag.js). Loads only when NEXT_PUBLIC_GOOGLE_ADS_ID is set, never on /admin. */
export const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? "";

export function GoogleAds() {
  const pathname = usePathname() ?? "";
  if (!/^AW-\d+$/.test(ADS_ID) || pathname.startsWith("/admin")) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${ADS_ID}`} strategy="afterInteractive" />
      <Script id="gtag-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${ADS_ID}');`}
      </Script>
    </>
  );
}
