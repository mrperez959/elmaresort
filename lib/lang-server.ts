import "server-only";
import { cookies, headers } from "next/headers";
import { LANG_COOKIE, makeL, pickLang, type Lang } from "./i18n";

export async function getLang(): Promise<Lang> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  if (h.get("x-lang") === "es") return "es"; // the /es/... URLs
  return pickLang(c.get(LANG_COOKIE)?.value, h.get("accept-language"));
}

/** Language given by the URL itself (/es/... = Spanish), used for canonical links. */
export async function getPathLang(): Promise<Lang> {
  return (await headers()).get("x-lang") === "es" ? "es" : "en";
}

export async function getL() {
  const lang = await getLang();
  return { lang, l: makeL(lang) };
}
