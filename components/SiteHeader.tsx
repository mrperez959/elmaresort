import Link from "next/link";
import type { PublicUser } from "@/lib/types";
import { LangToggle } from "./LangProvider";
import { getL } from "@/lib/lang-server";

export async function SiteHeader({ user, showTagline = true }: { user: PublicUser | null; showTagline?: boolean }) {
  const { lang, l } = await getL();
  const name = process.env.NEXT_PUBLIC_PROPERTY_NAME ?? "Vacation rental";
  const location = process.env.NEXT_PUBLIC_PROPERTY_LOCATION ?? "";
  const tagline =
    lang === "es"
      ? process.env.NEXT_PUBLIC_PROPERTY_TAGLINE_ES ??
        "Casa frente al agua con muelle privado, spa y sala de juegos. Reserva directo y ahórrate las comisiones."
      : (process.env.NEXT_PUBLIC_PROPERTY_TAGLINE ?? "");
  return (
    <>
      <nav className="topnav" aria-label="Account">
        <LangToggle />
        <Link href="/account">{user ? l(`${user.firstName}'s trips`, `Viajes de ${user.firstName}`) : l("Sign in", "Iniciar sesión")}</Link>
      </nav>
      <header className="masthead">
        <h1>
          <Link href="/" aria-label={l(`${name}, home`, `${name}, inicio`)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="logo"
              src="/logo-360.webp"
              srcSet="/logo-360.webp 1x, /logo-720.webp 2x"
              alt={name}
              width={360}
              height={296}
            />
          </Link>
        </h1>
        {showTagline && (
          <p className="place">
            {location}
            {location && tagline ? <br /> : null}
            {tagline}
          </p>
        )}
      </header>
    </>
  );
}
