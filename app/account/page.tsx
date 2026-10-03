import Link from "next/link";
import { AuthPanel, SignOutButton } from "@/components/AuthPanel";
import { FullInvoice } from "@/components/Invoice";
import { SiteHeader } from "@/components/SiteHeader";
import { currentUser } from "@/lib/auth";
import { bookingsForUser } from "@/lib/users";
import { todayAtProperty } from "@/lib/dates";
import { longDate, money } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your trips" };

export default async function Account() {
  const user = await currentUser();

  if (!user) {
    return (
      <main className="page">
        <SiteHeader user={null} showTagline={false} />
        <section className="account narrow-col">
          <h2>Sign in to see your trips</h2>
          <AuthPanel initialMode="login" />
        </section>
      </main>
    );
  }

  const bookings = await bookingsForUser(user.id);
  const today = todayAtProperty();
  const upcoming = bookings.filter((b) => b.checkOut >= today).reverse();
  const past = bookings.filter((b) => b.checkOut < today);

  const list = (items: typeof bookings) => (
    <ul className="trips">
      {items.map((b) => (
        <li key={b.code}>
          <div className="trip-dates">
            {longDate(b.checkIn)} to {longDate(b.checkOut)}
          </div>
          <div className="trip-meta">
            {b.guests} {b.guests === 1 ? "guest" : "guests"}
            {b.pets ? `, ${b.pets} ${b.pets === 1 ? "pet" : "pets"}` : ""}. Paid {money(b.total)}. Code{" "}
            <strong>{b.code}</strong>
            {b.status !== "confirmed" ? ` (${b.status})` : ""}
          </div>
          {b.quote && (
            <details className="trip-receipt">
              <summary>Receipt</summary>
              <FullInvoice quote={b.quote} />
            </details>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <main className="page">
      <SiteHeader user={user} showTagline={false} />
      <section className="account">
        <div className="account-head">
          <h2>Hi, {user.firstName}</h2>
          <SignOutButton />
        </div>
        <p className="fine">
          {user.email}
          {user.phone ? `, ${user.phone}` : ""}
        </p>

        <h3>Upcoming</h3>
        {upcoming.length ? (
          list(upcoming)
        ) : (
          <p>
            No upcoming trips. <Link href="/#book">Pick your dates</Link>
          </p>
        )}

        {past.length > 0 && (
          <>
            <h3>Past</h3>
            {list(past)}
          </>
        )}
      </section>
    </main>
  );
}
