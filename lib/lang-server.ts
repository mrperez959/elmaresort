import "server-only";
import { cookies, headers } from "next/headers";
import { LANG_COOKIE, makeL, pickLang, type Lang } from "./i18n";

export async function getLang(): Promise<Lang> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return pickLang(c.get(LANG_COOKIE)?.value, h.get("accept-language"));
}

export async function getL() {
  const lang = await getLang();
  return { lang, l: makeL(lang) };
}
