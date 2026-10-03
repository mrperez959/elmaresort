import type { Metadata, Viewport } from "next";
import "./globals.css";

const name = process.env.NEXT_PUBLIC_PROPERTY_NAME ?? "Vacation rental";

export const metadata: Metadata = {
  title: `${name}, book direct`,
  description: process.env.NEXT_PUBLIC_PROPERTY_TAGLINE ?? "Book directly with the host.",
};

export const viewport: Viewport = { themeColor: "#01325b" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
      <body>{children}</body>
    </html>
  );
}
