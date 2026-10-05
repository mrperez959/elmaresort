"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { track, flushNow } from "@/lib/track";

/** Page views and time on page. Not loaded on /admin. */
export function Analytics() {
  const pathname = usePathname();
  const visibleSince = useRef<number | null>(null);
  const engaged = useRef(0);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    track("pageview");
    engaged.current = 0;
    visibleSince.current = document.visibilityState === "visible" ? Date.now() : null;

    const report = () => {
      if (visibleSince.current) engaged.current += Date.now() - visibleSince.current;
      visibleSince.current = null;
      if (engaged.current > 1000) track("engaged", { ms: engaged.current, p: pathname });
      engaged.current = 0;
      flushNow();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") report();
      else visibleSince.current = Date.now();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", report);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", report);
      report(); // route change inside the app
    };
  }, [pathname]);

  return null;
}
