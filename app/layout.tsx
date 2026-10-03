import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ChatButton } from "@/components/ChatButton";
import { getSettings } from "@/lib/settings";

const name = process.env.NEXT_PUBLIC_PROPERTY_NAME ?? "Vacation rental";

export const metadata: Metadata = {
  title: `${name}, book direct`,
  description: process.env.NEXT_PUBLIC_PROPERTY_TAGLINE ?? "Book directly with the host.",
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
  const c = await contact();
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Cormorant+Garamond:wght@500;600;700&display=swap"
        />
      </head>
      <body>
        {children}
        {c && (c.whatsapp || c.phone || c.email) && <ChatButton {...c} propertyName={name} />}
      </body>
    </html>
  );
}
