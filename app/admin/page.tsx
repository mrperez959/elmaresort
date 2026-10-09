import Link from "next/link";
import { headers } from "next/headers";
import { AdminLogin, AdminReviews, AdminSettings, CopyField, AdminCancel, AdminBlocks } from "@/components/Admin";
import { query } from "@/lib/db";
import { AdminSmartPricing } from "@/components/AdminSmartPricing";
import { getDays } from "@/lib/availability";
import { priceNights } from "@/lib/smart-pricing";
import { addDays, todayAtProperty } from "@/lib/dates";
import { listReviews } from "@/lib/reviews";
import { exportToken } from "@/lib/calendar-export";
import { SignOutButton } from "@/components/AuthPanel";
import { isAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { recentBookings } from "@/lib/users";
import { runChecks } from "@/lib/diagnostics";
import { longDate, money } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function Admin() {
  if (!(await isAdmin())) {
    return (
      <main className="page narrow">
        <h1 className="admin-title">Admin</h1>
        <AdminLogin />
      </main>
    );
  }

  const [settings, bookings, checks, reviews, h, blocks] = await Promise.all([
    getSettings(),
    recentBookings(),
    runChecks(),
    listReviews(),
    headers(),
    query<{ id: string; start: string; end: string; note: string }>(
      `SELECT id, to_char(start_date, 'YYYY-MM-DD') AS start, to_char(end_date, 'YYYY-MM-DD') AS "end", note
       FROM owner_blocks WHERE end_date >= CURRENT_DATE ORDER BY start_date`,
    ),
  ]);
  // Use the public production domain (deployment-specific URLs can be password-protected by Vercel).
  const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const exportUrl = `${proto}://${host}/calendar/${exportToken()}.ics`;

  // Preview of the next 90 nights with the real calendar (skipped if calendars can't load).
  const today = todayAtProperty();
  const preview = await getDays(addDays(today, -14), addDays(today, 104))
    .then((days) => {
      const next = days.filter((d) => d.date >= today && d.date < addDays(today, 90));
      const prices = priceNights(next.map((d) => d.date), days, settings, today);
      return prices.map((p, i) => ({ ...p, booked: !next[i].available }));
    })
    .catch(() => null);

  return (
    <main className="page admin">
      <div className="account-head">
        <h1 className="admin-title">Settings</h1>
        <div className="admin-links">
          <Link href="/admin/analytics" className="manage-link">
            Analytics →
          </Link>
          <Link href="/admin/promos" className="manage-link">
            Influencer codes →
          </Link>
          <Link href="/admin/reports" className="manage-link">
            Reports →
          </Link>
          <SignOutButton admin />
        </div>
      </div>
      <section className="checks" aria-label="Connections">
        <h2 className="admin-section first">Connections</h2>
        <ul>
          {checks.map((c) => (
            <li key={c.name} className={`check ${c.status}`}>
              <span className="check-dot" aria-hidden="true" />
              <strong>{c.name}</strong>
              <span>{c.message}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="export-box" aria-labelledby="export-heading">
        <h2 id="export-heading" className="admin-section first">Send direct bookings to Airbnb and Vrbo</h2>
        <p>
          Paste this link in both platforms so they close the dates booked here and the dates you block below:
        </p>
        <CopyField value={exportUrl} />
        <ul className="field-hint">
          <li>
            <strong>Airbnb:</strong> Listings → your listing → Availability → Connect calendars → Connect another
            website → paste the link, name it &quot;Elma Resort website&quot;.
          </li>
          <li>
            <strong>Vrbo:</strong> Calendar → Import/Export → Import calendar → paste the link, name it &quot;Elma
            Resort website&quot;.
          </li>
          <li>
            Also connect Airbnb and Vrbo to each other (Airbnb&apos;s export link into Vrbo, and Vrbo&apos;s into Airbnb),
            so a booking on one closes the other.
          </li>
          <li>
            Airbnb and Vrbo re-read imported calendars every few hours, not instantly. You get an email with every
            direct booking: for bookings starting soon, block the dates on both platforms by hand.
          </li>
        </ul>
      </section>

      <AdminSmartPricing initial={settings.smartPricing} preview={preview} />

      <AdminSettings initial={settings} />

      <h2 className="admin-section">Reviews</h2>
      <AdminReviews initial={reviews} />

      <h2 className="admin-section">Blocked dates</h2>
      <AdminBlocks blocks={blocks} />

      <h2 className="admin-section">Direct bookings</h2>
      {bookings.length === 0 ? (
        <p className="fine">No bookings from the website yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Dates</th>
                <th>Guest</th>
                <th>Party</th>
                <th>Total</th>
                <th>Code</th>
                <th>Booked</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.code}>
                  <td>
                    {longDate(b.checkIn)} to {longDate(b.checkOut)}
                  </td>
                  <td>
                    {b.guestName}
                    <br />
                    <span className="fine">{b.guestEmail}</span>
                    <br />
                    <span className="fine">{b.guestPhone}</span>
                  </td>
                  <td>
                    {b.guests}
                    {b.pets ? ` + ${b.pets} pet${b.pets === 1 ? "" : "s"}` : ""}
                  </td>
                  <td>{money(b.total)}</td>
                  <td>{b.code}</td>
                  <td>{b.createdAt.slice(0, 10)}</td>
                  <td>
                    {b.status === "confirmed" ? "Confirmed" : "Cancelled"}
                    {b.refunded ? <span className="fine"><br />Refunded {money(b.refunded)}</span> : null}
                    {b.status === "confirmed" && b.quote && <AdminCancel code={b.code} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
