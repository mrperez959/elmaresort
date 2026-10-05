import type { Quote } from "@/lib/types";
import { money } from "@/lib/format";

type Row = { label: string; amount: number; kind?: "discount" | "tax" };

function nightRows(q: Quote): Row[] {
  const rows: Row[] = [];
  if (q.weekdayNights) {
    rows.push({
      label: `${money(q.weekdayRate)} × ${q.weekdayNights} ${q.weekdayNights === 1 ? "night" : "nights"}`,
      amount: q.weekdayNights * q.weekdayRate,
    });
  }
  if (q.weekendNights) {
    rows.push({
      label: `${money(q.weekendRate)} × ${q.weekendNights} weekend ${q.weekendNights === 1 ? "night" : "nights"}`,
      amount: q.weekendNights * q.weekendRate,
    });
  }
  if (q.lengthDiscount) {
    rows.push({ label: `${q.lengthDiscount.label} (${q.lengthDiscount.percent}%)`, amount: -q.lengthDiscount.amount, kind: "discount" });
  }
  if (q.directDiscount) {
    rows.push({ label: `Direct booking discount (${q.directDiscount.percent}%)`, amount: -q.directDiscount.amount, kind: "discount" });
  }
  if (q.promoDiscount && q.promoDiscount.amount > 0) {
    rows.push({ label: `Promo code ${q.promoDiscount.code} (${q.promoDiscount.percent}%)`, amount: -q.promoDiscount.amount, kind: "discount" });
  }
  if (q.cleaningFee) rows.push({ label: "Cleaning fee", amount: q.cleaningFee });
  if (q.petFee) rows.push({ label: `Pet fee (${q.pets} ${q.pets === 1 ? "pet" : "pets"})`, amount: q.petFee });
  return rows;
}

function Lines({ rows }: { rows: Row[] }) {
  return (
    <>
      {rows.map((r) => (
        <tr key={r.label} className={r.kind}>
          <th scope="row">{r.label}</th>
          <td>{r.amount < 0 ? `−${money(-r.amount)}` : money(r.amount)}</td>
        </tr>
      ))}
    </>
  );
}

/**
 * Step 1, on the calendar: everything the guest must pay except government
 * taxes, with that total as the most prominent number (FTC fee rule).
 */
export function PriceBeforeTaxes({ quote }: { quote: Quote }) {
  return (
    <div className="price-preview">
      <div className="price-total">
        <span className="price-total-amount">{money(quote.subtotal)}</span>
        <span className="price-total-label">
          total for {quote.nights} {quote.nights === 1 ? "night" : "nights"}, before taxes
        </span>
      </div>
      <table className="breakdown compact">
        <tbody>
          <Lines rows={nightRows(quote)} />
        </tbody>
      </table>
      <p className="fine">
        {quote.taxes.length
          ? "Taxes are added on the next step, before you pay."
          : "No taxes are added to this stay."}
      </p>
    </div>
  );
}

/** Step 2, at checkout: the full invoice. Taxes show as one line, like Airbnb. */
export function FullInvoice({ quote }: { quote: Quote }) {
  return (
    <table className="breakdown invoice">
      <tbody>
        <Lines rows={nightRows(quote)} />
        <tr className="subtotal">
          <th scope="row">Total before taxes</th>
          <td>{money(quote.subtotal)}</td>
        </tr>
        {quote.tax > 0 && (
          <tr className="tax">
            <th scope="row">Taxes</th>
            <td>{money(quote.tax)}</td>
          </tr>
        )}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">Total due (USD)</th>
          <td>{money(quote.total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
