import Link from "next/link";
import { AuthPanel, SignOutButton, VerifyEmail } from "@/components/AuthPanel";
import { SiteHeader } from "@/components/SiteHeader";
import { currentUser } from "@/lib/auth";
import { bookingsForUser } from "@/lib/users";
import { todayAtProperty } from "@/lib/dates";
import { longDate, money } from "@/lib/format";
import { getL } from "@/lib/lang-server";
import { guestsWord, petsWord } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your trips" };

export default async function Account() {
  const [user, { lang, l }] = await Promise.all([currentUser(), getL()]);

  if (!user) {
    return (
      <main className="page">
        <SiteHeader user={null} showTagline={false} />
        <section className="account narrow-col">
          <h2>{l("Sign in to see your trips", "Inicia sesión para ver tus viajes")}</h2>
          <AuthPanel initialMode="login" />
        </section>
      </main>
    );
  }

  if (!user.emailVerified) {
    return (
      <main className="page">
        <SiteHeader user={user} showTagline={false} />
        <section className="account narrow-col">
          <h2>{l(`Hi, ${user.firstName}`, `Hola, ${user.firstName}`)}</h2>
          <VerifyEmail email={user.email} />
          <SignOutButton />
        </section>
      </main>
    );
  }

  const bookings = await bookingsForUser(user.id);
  const today = todayAtProperty();
  const upcoming = bookings.filter((b) => b.checkOut >= today && b.status === "confirmed").reverse();
  const past = bookings.filter((b) => b.checkOut < today || b.status !== "confirmed");

  const list = (items: typeof bookings) => (
    <ul className="trips">
      {items.map((b) => (
        <li key={b.code}>
          <div className="trip-dates">
            {longDate(b.checkIn, lang)} {l("to", "al")} {longDate(b.checkOut, lang)}
          </div>
          <div className="trip-meta">
            {b.guests} {guestsWord(lang, b.guests)}
            {b.pets ? `, ${b.pets} ${petsWord(lang, b.pets)}` : ""}. {l("Paid", "Pagado")} {money(b.total)}.{" "}
            {l("Code", "Código")} <strong>{b.code}</strong>
            {b.status === "cancelled" ? l(" Cancelled.", " Cancelado.") : ""}
            {b.refunded ? l(` Refunded ${money(b.refunded)}.`, ` Reembolsado ${money(b.refunded)}.`) : ""}
          </div>
          {b.quote ? (
            <Link href={`/account/trips/${b.code}`} className="manage-link">
              {b.status === "confirmed" && b.checkOut >= today
                ? l("View, change or cancel", "Ver, cambiar o cancelar")
                : l("View receipt", "Ver recibo")}
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );

  return (
    <main className="page">
      <SiteHeader user={user} showTagline={false} />
      <section className="account">
        <div className="account-head">
          <h2>{l(`Hi, ${user.firstName}`, `Hola, ${user.firstName}`)}</h2>
          <SignOutButton />
        </div>
        <p className="fine">
          {user.email}
          {user.phone ? `, ${user.phone}` : ""}
        </p>

        <h3>{l("Upcoming", "Próximos")}</h3>
        {upcoming.length ? (
          list(upcoming)
        ) : (
          <p>
            {l("No upcoming trips.", "No tienes viajes próximos.")} <Link href="/#book">{l("Pick your dates", "Elige tus fechas")}</Link>
          </p>
        )}

        {past.length > 0 && (
          <>
            <h3>{l("Past and cancelled", "Pasados y cancelados")}</h3>
            {list(past)}
          </>
        )}
      </section>
    </main>
  );
}
