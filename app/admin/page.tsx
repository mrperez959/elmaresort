import { AdminLogin, AdminSettings } from "@/components/Admin";
import { SignOutButton } from "@/components/AuthPanel";
import { isAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { recentBookings } from "@/lib/users";
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

  const [settings, bookings] = await Promise.all([getSettings(), recentBookings()]);

  return (
    <main className="page admin">
      <div className="account-head">
        <h1 className="admin-title">Settings</h1>
        <SignOutButton admin />
      </div>
      <AdminSettings initial={settings} />

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
                  </td>
                  <td>
                    {b.guests}
                    {b.pets ? ` + ${b.pets} pet${b.pets === 1 ? "" : "s"}` : ""}
                  </td>
                  <td>{money(b.total)}</td>
                  <td>{b.code}</td>
                  <td>{b.createdAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
