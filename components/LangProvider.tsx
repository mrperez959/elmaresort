"use client";

import { createContext, useContext } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LANG_COOKIE, localizeMessage, makeL, type Lang } from "@/lib/i18n";

const Ctx = createContext<Lang>("en");

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}

/** { lang, l("English", "Español"), msg(serverMessage) } */
export function useL() {
  const lang = useContext(Ctx);
  return { lang, l: makeL(lang), msg: (m: string) => localizeMessage(lang, m) };
}

export function LangToggle() {
  const { lang } = useL();
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const next: Lang = lang === "es" ? "en" : "es";
  return (
    <button
      type="button"
      className="lang-toggle"
      lang={next}
      onClick={() => {
        document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        // Public pages have their own address per language (/ and /es/...).
        const base = pathname === "/es" ? "/" : pathname.startsWith("/es/") ? pathname.slice(3) : pathname;
        const isPublic = ["/", "/house-rules", "/rental-agreement", "/refunds", "/privacy"].includes(base);
        if (isPublic) {
          const target = next === "es" ? (base === "/" ? "/es" : `/es${base}`) : base;
          router.push(`${target}${window.location.search}`);
          router.refresh();
        } else router.refresh();
      }}
    >
      {lang === "es" ? "English" : "Español"}
    </button>
  );
}
