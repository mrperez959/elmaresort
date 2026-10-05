"use client";

import { createContext, useContext } from "react";
import { useRouter } from "next/navigation";
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
  const next: Lang = lang === "es" ? "en" : "es";
  return (
    <button
      type="button"
      className="lang-toggle"
      lang={next}
      onClick={() => {
        document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
    >
      {lang === "es" ? "English" : "Español"}
    </button>
  );
}
