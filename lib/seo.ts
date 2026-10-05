import "server-only";
import type { Metadata } from "next";
import { getPathLang } from "./lang-server";

const name = () => process.env.NEXT_PUBLIC_PROPERTY_NAME ?? "Elma Resort";

const TITLES = {
  en: "Waterfront Vacation Rental in Tampa with Hot Tub, Dock & Kayaks",
  es: "Casa vacacional frente al agua en Tampa con spa, muelle y kayaks",
};
const DESCRIPTIONS = {
  en: "Book Elma Resort direct: a remodeled canal-front home in Tampa, FL for up to 10 guests, with private dock, kayaks, hot tub, fire pit and game room. Pet friendly, 15 minutes from the airport.",
  es: "Reserva Elma Resort directo: casa remodelada frente a un canal en Tampa, FL, para hasta 10 huéspedes, con muelle privado, kayaks, spa, fogata y sala de juegos. Se admiten mascotas, a 15 minutos del aeropuerto.",
};

/** Canonical + hreflang links for a public page that exists at /path and /es/path. */
export async function pageMetadata(path: string, title?: { en: string; es: string }): Promise<Metadata> {
  const lang = await getPathLang();
  const es = path === "/" ? "/es" : `/es${path}`;
  const pageTitle = title ? title[lang] : `${name()} | ${TITLES[lang]}`;
  return {
    title: title ? { absolute: `${title[lang]} | ${name()}` } : { absolute: pageTitle },
    description: path === "/" ? DESCRIPTIONS[lang] : undefined,
    alternates: {
      canonical: lang === "es" ? es : path,
      languages: { "en-US": path, "es-US": es, "x-default": path },
    },
    openGraph: {
      title: pageTitle,
      description: DESCRIPTIONS[lang],
      locale: lang === "es" ? "es_US" : "en_US",
      alternateLocale: lang === "es" ? ["en_US"] : ["es_US"],
      url: lang === "es" ? es : path,
      images: [{ url: "/og.jpg", width: 1200, height: 630 }],
    },
  };
}
