import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { allBookings, monthlyReport } from "@/lib/reports";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports", robots: { index: false, follow: false } };

export default async function Reports({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  if (!(await isAdmin())) redirect("/admin");
  const { year: raw } = await searchParams;
  const thisYear = new Date().getFullYear();
  const year = Number(raw) >= 2024 && Number(raw) <= thisYear + 1 ? Number(raw) : thisYear;
  const bookings = await allBookings();
  const { rows, taxNames } = monthlyReport(bookings, year);
  const total = rows.reduce(
    (a, r) => ({
      bookings: a.bookings + r.bookings,
      nights: a.nights + r.nights,
      subtotal: a.subtotal + r.subtotal,
      taxTotal: a.taxTotal + r.taxTotal,
      collected: a.collected + r.collected,
      taxes: Object.fromEntries(taxNames.map((n) => [n, (a.taxes[n] ?? 0) + (r.taxes[n] ?? 0)])),
    }),
    { bookings: 0, nights: 0, subtotal: 0, taxTotal: 0, collected: 0, taxes: {} as Record<string, number> },
  );
  const monthName = (m: string) =>
    new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(new Date(`${m}-15T12:00:00Z`));

  return (
    <main className="page admin">
      <div className="account-head">
        <h1 className="admin-title">Reports</h1>
        <Link href="/admin" className="link">
          ← Back to settings
        </Link>
      </div>

      <nav className="range" aria-label="Year">
        {[thisYear - 1, thisYear, thisYear + 1].map((y) => (
          <Link key={y} href={`/admin/reports?year=${y}`} aria-current={y === year ? "page" : undefined}>
            {y}
          </Link>
        ))}
      </nav>

      <h2 className="admin-section first">Taxes collected by month</h2>
      <p className="fine">
        Direct bookings only (Airbnb pays the taxes on its own bookings). By the month the guest paid; refunds reduce
        each line in proportion. Confirm with your accountant which basis your tax returns use.
      </p>
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Bookings</th>
              <th>Nights</th>
              <th>Before taxes</th>
              {taxNames.map((n) => (
                <th key={n}>{n}</th>
              ))}
              <th>Total taxes</th>
              <th>Collected</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month}>
                <td>{monthName(r.month)}</td>
                <td>{r.bookings}</td>
                <td>{r.nights}</td>
                <td>{money(r.subtotal)}</td>
                {taxNames.map((n) => (
                  <td key={n}>{money(r.taxes[n] ?? 0)}</td>
                ))}
                <td>
                  <strong>{money(r.taxTotal)}</strong>
                </td>
                <td>{money(r.collected)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>{year}</th>
              <th>{total.bookings}</th>
              <th>{total.nights}</th>
              <th>{money(total.subtotal)}</th>
              {taxNames.map((n) => (
                <th key={n}>{money(total.taxes[n] ?? 0)}</th>
              ))}
              <th>{money(total.taxTotal)}</th>
              <th>{money(total.collected)}</th>
            </tr>
          </tfoot>
        </table>
      </div>

      <h2 className="admin-section">Download</h2>
      <div className="admin-links downloads">
        <a className="pay" href={`/api/admin/export?type=taxes&year=${year}`}>
          Taxes {year} (CSV)
        </a>
        <a className="pay" href="/api/admin/export?type=bookings">
          All bookings (CSV)
        </a>
      </div>
      <p className="fine">CSV files open in Excel, Numbers or Google Sheets.</p>
    </main>
  );
}
