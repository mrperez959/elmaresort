"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Scroll reveal. Anything marked data-reveal fades/rises in the first time it
 * scrolls into view; children of data-reveal-group arrive one after another.
 *
 * Progressive: the page is fully visible without JavaScript, and whatever is
 * already on screen when the page loads is shown immediately (never animated),
 * so nothing ever blinks or delays the first paint.
 */
export function Reveal() {
  const pathname = usePathname();

  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-in)"));

    // Stagger: position inside its group, capped so long lists don't drag on.
    document.querySelectorAll<HTMLElement>("[data-reveal-group]").forEach((group) => {
      group.querySelectorAll<HTMLElement>(":scope > [data-reveal]").forEach((el, i) => {
        el.style.setProperty("--i", String(Math.min(i, 6)));
      });
    });

    // Only elements below the fold right now get hidden ("pending"); anything
    // added later (e.g. "show more reviews") simply appears.
    const vh = window.innerHeight;
    const pending = items.filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) {
        el.classList.add("is-in");
        return false;
      }
      el.classList.add("reveal-pending");
      return true;
    });

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    pending.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  return null;
}
