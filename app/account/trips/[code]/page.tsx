import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { FullInvoice } from "@/components/Invoice";
import { TripManager } from "@/components/TripManager";
import { currentUser } from "@/lib/auth";
import { getTrip, canChange, refundNow } from "@/lib/trips";
import { getSettings } from "@/lib/settings";
import { POLICIES, policyDeadlines, GRACE_NOTE, FEES_NOTE } from "@/lib/policy";
import { todayAtProperty } from "@/lib/dates";
import { longDate, money } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your trip" };

const hourLabel = (h: number) => new Intl.DateTimeFormat("en-US", { hour: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 1, h)));

export default async function TripPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/account");
  const { code } = await params;
  const [trip, settings] = await Promise.all([getTrip(code, user.id), getSettings()]);
  if (!trip) notFound();

  const q = trip.quote;
  const changeable = canChange(trip);
  const refund = changeable ? refundNow(trip) : null;
  const guests = q.adults + q.children;

  return (
    <main className="page">
      <SiteHeader user={user} showTagline={false} />
      <p>
        <Link href="/account" className="link">
          ← Your trips
        </Link>
      </p>
      <h1 className="checkout-title">
        {longDate(q.checkIn)} to {longDate(q.checkOut)}
      </h1>

      <div className="checkout">
        <section className="checkout-trip">
          <dl className="trip-facts">
            <div>
              <dt>Confirmation code</dt>
              <dd>{trip.code}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd className={trip.status === "cancelled" ? "status-cancelled" : undefined}>
                {trip.status === "cancelled" ? "Cancelled" : "Confirmed"}
              </dd>
            </div>
            <div>
              <dt>Check-in and check-out</dt>
              <dd>
                Check-in after {hourLabel(settings.checkInHour)}, check-out by {hourLabel(settings.checkOutHour)}
              </dd>
            </div>
            <div>
              <dt>Guests</dt>
              <dd>
                {guests} {guests === 1 ? "guest" : "guests"}
                {q.infants ? `, ${q.infants} ${q.infants === 1 ? "infant" : "infants"}` : ""}
                {q.pets ? `, ${q.pets} ${q.pets === 1 ? "pet" : "pets"}` : ""}
              </dd>
            </div>
            {trip.refunded > 0 && (
              <div>
                <dt>Refunded</dt>
                <dd>{money(trip.refunded)}</dd>
              </div>
            )}
          </dl>

          <h2 className="invoice-heading">Receipt</h2>
          <FullInvoice quote={q} />

          <h2 className="invoice-heading">Cancellation policy: {POLICIES[trip.policy].name}</h2>
          <ul className="policy-lines">
            {policyDeadlines(trip.policy, trip.checkInAt).map((l) => (
              <li key={l}>{l}</li>
            ))}
            <li>{GRACE_NOTE}</li>
            <li>{FEES_NOTE}</li>
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
              today={todayAtProperty()}
            />
          ) : (
            <p className="notice">
              {trip.status === "cancelled"
                ? "This trip was cancelled."
                : "Check-in time has passed, so this trip can't be changed online. Use the chat button to reach us."}
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}
