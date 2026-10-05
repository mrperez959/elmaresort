import { isAdmin } from "@/lib/auth";
import { allBookings, monthlyReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

const cell = (v: unknown) => {
  const s = String(v ?? "");
  // Quote fields and stop spreadsheet formula injection.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const csv = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
const d = (c: number) => (c / 100).toFixed(2);

export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response("Sign in as admin.", { status: 401 });
  const url = new URL(req.url);
  const type = url.searchParams.get("type") === "taxes" ? "taxes" : "bookings";
  const bookings = await allBookings();
  let body: string;
  let name: string;

  if (type === "taxes") {
    const year = Number(url.searchParams.get("year")) || new Date().getFullYear();
    const { rows, taxNames } = monthlyReport(bookings, year);
    body = csv([
      ["Month", "Bookings", "Nights", "Nights revenue", "Cleaning fees", "Pet fees", "Total before taxes", ...taxNames, "Total taxes", "Collected"],
      ...rows.map((r) => [
        r.month,
        r.bookings,
        r.nights,
        d(r.accommodation),
        d(r.cleaning),
        d(r.pets),
        d(r.subtotal),
        ...taxNames.map((n) => d(r.taxes[n] ?? 0)),
        d(r.taxTotal),
        d(r.collected),
      ]),
    ]);
    name = `elma-resort-taxes-${year}.csv`;
  } else {
    body = csv([
      ["Code", "Status", "Booked on", "Check-in", "Check-out", "Nights", "Guest", "Email", "Phone", "Adults", "Children", "Infants", "Pets",
        "Nights revenue", "Cleaning", "Pet fee", "Total before taxes", "Taxes", "Total", "Paid", "Refunded", "Promo code"],
      ...bookings.map((b) => [
        b.code, b.status, b.bookedOn, b.checkIn, b.checkOut, b.quote.nights, b.guest, b.email, b.phone,
        b.quote.adults, b.quote.children, b.quote.infants, b.quote.pets,
        d(b.quote.accommodation), d(b.quote.cleaningFee), d(b.quote.petFee), d(b.quote.subtotal), d(b.quote.tax),
        d(b.quote.total), d(b.paid), d(b.refunded), b.promo ?? "",
      ]),
    ]);
    name = "elma-resort-bookings.csv";
  }
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
