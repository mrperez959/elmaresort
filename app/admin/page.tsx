import Link from "next/link";
import { headers } from "next/headers";
import { AdminLogin, AdminReviews, AdminSettings, CopyField, AdminCancel } from "@/components/Admin";
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

  const [settings, bookings, checks, reviews, h] = await Promise.all([
    getSettings(),
    recentBookings(),
    runChecks(),
    listReviews(),
    headers(),
  ]);
  // Use the public production domain (deployment-specific URLs can be password-protected by Vercel).
  const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const exportUrl = `${proto}://${host}/calendar/${exportToken()}.ics`;

  return (
    <main className="page admin">
      <div className="account-head">
        <h1 className="admin-title">Settings</h1>
        <div className="admin-links">
          <Link href="/admin/analytics" className="manage-link">
            Analytics →
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
        <h2 id="export-heading" className="admin-section first">Send direct bookings to Hospitable</h2>
        <p>
          In Hospitable, open your property and under Imported iCal click Add External iCal, then paste this link.
          Hospitable reads it about every 20 minutes and blocks the dates on Airbnb and Vrbo for you.
        </p>
        <CopyField value={exportUrl} />
        <p className="field-hint">
          If your plan doesn&apos;t allow iCal imports, paste it directly in Airbnb (Availability → Connect calendars) and
          Vrbo (Import/Export) instead; they re-read it every few hours. Keep this link private.
        </p>
      </section>

      <AdminSettings initial={settings} />

      <h2 className="admin-section">Reviews</h2>
      <AdminReviews initial={reviews} />

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
