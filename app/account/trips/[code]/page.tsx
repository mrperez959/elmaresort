import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { FullInvoice } from "@/components/Invoice";
import { TripManager } from "@/components/TripManager";
import { currentUser } from "@/lib/auth";
import { getTrip, canChange, refundNow } from "@/lib/trips";
import { getSettings } from "@/lib/settings";
import { policyName, policyDeadlines, graceNote, feesNote } from "@/lib/policy";
import { todayAtProperty } from "@/lib/dates";
import { longDate, money, hourLabel } from "@/lib/format";
import { getL } from "@/lib/lang-server";
import { guestsWord, infantsWord, petsWord } from "@/lib/i18n";
import { checkInMessage } from "@/lib/legal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your trip" };

export default async function TripPage({ params }: { params: Promise<{ code: string }> }) {
  const [user, { lang, l }] = await Promise.all([currentUser(), getL()]);
  if (!user || !user.emailVerified) redirect("/account");
  const { code } = await params;
  const [trip, settings] = await Promise.all([getTrip(code, user.id), getSettings()]);
  if (!trip) notFound();

  const q = trip.quote;
  const today = todayAtProperty();
  const changeable = canChange(trip);
  const refund = changeable ? refundNow(trip) : null;
  const guests = q.adults + q.children;
  const arrivalDay = trip.status === "confirmed" && today >= q.checkIn && today <= q.checkOut;

  return (
    <main className="page">
      <SiteHeader user={user} showTagline={false} />
      <p>
        <Link href="/account" className="link">
          ← {l("Your trips", "Tus viajes")}
        </Link>
      </p>
      <h1 className="checkout-title">
        {longDate(q.checkIn, lang)} {l("to", "al")} {longDate(q.checkOut, lang)}
      </h1>

      <div className="checkout">
        <section className="checkout-trip">
          <dl className="trip-facts">
            <div>
              <dt>{l("Confirmation code", "Código de confirmación")}</dt>
              <dd>{trip.code}</dd>
            </div>
            <div>
              <dt>{l("Status", "Estado")}</dt>
              <dd className={trip.status === "cancelled" ? "status-cancelled" : undefined}>
                {trip.status === "cancelled" ? l("Cancelled", "Cancelado") : l("Confirmed", "Confirmado")}
              </dd>
            </div>
            <div>
              <dt>{l("Check-in and check-out", "Llegada y salida")}</dt>
              <dd>
                {l(
                  `Check-in after ${hourLabel(settings.checkInHour, lang)}, check-out by ${hourLabel(settings.checkOutHour, lang)}`,
                  `Llegada desde las ${hourLabel(settings.checkInHour, lang)}, salida antes de las ${hourLabel(settings.checkOutHour, lang)}`,
                )}
              </dd>
            </div>
            <div>
              <dt>{l("Guests", "Huéspedes")}</dt>
              <dd>
                {guests} {guestsWord(lang, guests)}
                {q.infants ? `, ${q.infants} ${infantsWord(lang, q.infants)}` : ""}
                {q.pets ? `, ${q.pets} ${petsWord(lang, q.pets)}` : ""}
              </dd>
            </div>
            {trip.refunded > 0 && (
              <div>
                <dt>{l("Refunded", "Reembolsado")}</dt>
                <dd>{money(trip.refunded)}</dd>
              </div>
            )}
          </dl>

          <h2 className="invoice-heading">{l("Address and check-in", "Dirección y llegada")}</h2>
          {trip.status !== "confirmed" ? (
            <p className="fine">{l("Not available for cancelled trips.", "No disponible para viajes cancelados.")}</p>
          ) : arrivalDay && settings.propertyAddress ? (
            <div className="arrival">
              <p className="arrival-address">{settings.propertyAddress}</p>
              <a
                className="manage-link"
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(settings.propertyAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {l("Directions in Google Maps", "Cómo llegar en Google Maps")}
              </a>
              {settings.checkInInstructions && (
                <p className="arrival-notes">{checkInMessage(settings, lang, user.firstName)}</p>
              )}
            </div>
          ) : (
            <p>
              {l("The exact address and check-in instructions appear here on", "La dirección exacta y las instrucciones de llegada aparecen aquí el")}{" "}
              <strong>{longDate(q.checkIn, lang)}</strong>
              {l(
                ", your check-in day. We'll also email them to you that morning.",
                ", tu día de llegada. También te las enviaremos por email esa mañana.",
              )}
            </p>
          )}

          <h2 className="invoice-heading">{l("Receipt", "Recibo")}</h2>
          <FullInvoice quote={q} />

          <h2 className="invoice-heading">
            {l("Cancellation policy", "Política de cancelación")}: {policyName(trip.policy, lang)}
          </h2>
          <ul className="policy-lines">
            {policyDeadlines(trip.policy, trip.checkInAt, "America/New_York", lang).map((x) => (
              <li key={x}>{x}</li>
            ))}
            <li>{graceNote(lang)}</li>
            <li>{feesNote(lang)}</li>
          </ul>
        </section>

        <aside className="summary">
          {changeable ? (
            <TripManager
              code={trip.code}
              quote={q}
              user={user}
              canChange={changeable}
              refundNow={refund ? { amount: refund.refund, reason: refund.reason } : null}
              maxGuests={settings.maxGuests}
              maxPets={settings.maxPets}
              petFee={settings.petFee}
              today={today}
            />
          ) : (
            <p className="notice">
              {trip.status === "cancelled"
                ? l("This trip was cancelled.", "Este viaje fue cancelado.")
                : l(
                    "Check-in time has passed, so this trip can't be changed online. Use the chat button to reach us.",
                    "Ya pasó la hora de llegada, así que este viaje no se puede cambiar en línea. Escríbenos con el botón de chat.",
                  )}
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}
