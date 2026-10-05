import type { Metadata, Viewport } from "next";
import "./globals.css";
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
};

export const viewport: Viewport = { themeColor: "#01325b" };

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
    <html lang={lang}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Cormorant+Garamond:wght@500;600;700&display=swap"
        />
      </head>
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
