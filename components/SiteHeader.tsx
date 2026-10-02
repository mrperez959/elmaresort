import Link from "next/link";
import type { PublicUser } from "@/lib/types";

export function SiteHeader({ user, showTagline = true }: { user: PublicUser | null; showTagline?: boolean }) {
  const name = process.env.NEXT_PUBLIC_PROPERTY_NAME ?? "Vacation rental";
  const location = process.env.NEXT_PUBLIC_PROPERTY_LOCATION ?? "";
  const tagline = process.env.NEXT_PUBLIC_PROPERTY_TAGLINE ?? "";
  return (
    <>
      <nav className="topnav" aria-label="Account">
        <Link href="/account">{user ? `${user.firstName}'s trips` : "Sign in"}</Link>
      </nav>
      <header className="masthead">
        <h1>
          <Link href="/">{name}</Link>
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
