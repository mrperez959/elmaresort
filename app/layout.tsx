import type { Metadata, Viewport } from "next";
import "./globals.css";
import { display, body } from "./fonts";
import { ChatButton } from "@/components/ChatButton";
import { Analytics } from "@/components/Analytics";
import { LangProvider } from "@/components/LangProvider";
import { SiteFooter } from "@/components/SiteFooter";
import { getLang } from "@/lib/lang-server";
import { getSettings } from "@/lib/settings";

const name = process.env.NEXT_PUBLIC_PROPERTY_NAME ?? "Vacation rental";

const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const description =
  process.env.NEXT_PUBLIC_PROPERTY_TAGLINE ??
  "Waterfront home in Tampa with a private dock, hot tub and game room. Book direct and skip the platform fees.";

export const metadata: Metadata = {
  metadataBase: new URL(host ? `https://${host}` : "http://localhost:3000"),
  title: { default: `${name}, Tampa waterfront vacation home`, template: `%s | ${name}` },
  description,
  openGraph: {
    type: "website",
    siteName: name,
    title: `${name}, Tampa waterfront vacation home`,
    description,
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: `${name} hot tub on the canal` }],
    locale: "en_US",
    alternateLocale: ["es_US"],
  },
  twitter: { card: "summary_large_image", title: name, description, images: ["/og.jpg"] },
  // Search Console / Bing Webmaster Tools ownership tags, set in Vercel.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined,
  },
};

// Edge to edge on phones (content padded with env(safe-area-inset-*)), the
// status bar matches the page background, and the keyboard resizes the layout.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#f4f7fa",
};

async function contact() {
  try {
    const s = await getSettings();
    return { whatsapp: s.contactWhatsApp, phone: s.contactPhone, email: s.contactEmail };
  } catch {
    return null; // database not configured yet: no chat button
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [c, lang] = await Promise.all([contact(), getLang()]);
  return (
    <html lang={lang} className={`${display.variable} ${body.variable}`}>
      <body>
        <LangProvider lang={lang}>
        {children}
        <SiteFooter name={name} email={c?.email ?? ""} phone={c?.phone ?? ""} whatsapp={c?.whatsapp ?? ""} />
        <Analytics />
        {c && (c.whatsapp || c.phone || c.email) && <ChatButton {...c} propertyName={name} />}
        </LangProvider>
      </body>
    </html>
  );
}
