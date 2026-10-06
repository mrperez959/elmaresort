"use client";

import type { Quote } from "@/lib/types";
import { money } from "@/lib/format";
import { nightsWord, petsWord, type Lang, makeL } from "@/lib/i18n";
import { useL } from "./LangProvider";

type Row = { label: string; amount: number; kind?: "discount" | "tax" };

function nightRows(q: Quote, lang: Lang): Row[] {
  const l = makeL(lang);
  const rows: Row[] = [];
  if (q.nightly?.length) {
    // Group nights that cost the same: "$360.00 × 2 nights".
    const groups: Array<{ price: number; count: number }> = [];
    for (const n of q.nightly) {
      const g = groups.find((x) => x.price === n.price);
      if (g) g.count++;
      else groups.push({ price: n.price, count: 1 });
    }
    for (const g of groups) {
      rows.push({ label: `${money(g.price)} × ${g.count} ${nightsWord(lang, g.count)}`, amount: g.price * g.count });
    }
  } else if (q.weekdayNights) {
    rows.push({
      label: `${money(q.weekdayRate)} × ${q.weekdayNights} ${nightsWord(lang, q.weekdayNights)}`,
      amount: q.weekdayNights * q.weekdayRate,
    });
  }
  if (!q.nightly?.length && q.weekendNights) {
    rows.push({
      label: l(
        `${money(q.weekendRate)} × ${q.weekendNights} weekend ${nightsWord(lang, q.weekendNights)}`,
        `${money(q.weekendRate)} × ${q.weekendNights} ${nightsWord(lang, q.weekendNights)} de fin de semana`,
      ),
      amount: q.weekendNights * q.weekendRate,
    });
  }
  if (q.lengthDiscount) {
    const label =
      lang === "es" ? (q.lengthDiscount.label.startsWith("Monthly") ? "Descuento mensual" : "Descuento semanal") : q.lengthDiscount.label;
    rows.push({ label: `${label} (${q.lengthDiscount.percent}%)`, amount: -q.lengthDiscount.amount, kind: "discount" });
  }
  if (q.directDiscount) {
    rows.push({
      label: l(`Direct booking discount (${q.directDiscount.percent}%)`, `Descuento por reserva directa (${q.directDiscount.percent}%)`),
      amount: -q.directDiscount.amount,
      kind: "discount",
    });
  }
  if (q.promoDiscount && q.promoDiscount.amount > 0) {
    rows.push({
      label: l(`Promo code ${q.promoDiscount.code} (${q.promoDiscount.percent}%)`, `Código ${q.promoDiscount.code} (${q.promoDiscount.percent}%)`),
      amount: -q.promoDiscount.amount,
      kind: "discount",
    });
  }
  if (q.cleaningFee) rows.push({ label: l("Cleaning fee", "Tarifa de limpieza"), amount: q.cleaningFee });
  if (q.petFee) rows.push({ label: l(`Pet fee (${q.pets} ${petsWord(lang, q.pets)})`, `Tarifa de mascota (${q.pets} ${petsWord(lang, q.pets)})`), amount: q.petFee });
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
  const { lang, l } = useL();
  return (
    <div className="price-preview">
      <div className="price-total">
        <span className="price-total-amount">{money(quote.subtotal)}</span>
        <span className="price-total-label">
          {l(
            `total for ${quote.nights} ${nightsWord(lang, quote.nights)}, before taxes`,
            `total por ${quote.nights} ${nightsWord(lang, quote.nights)}, antes de impuestos`,
          )}
        </span>
      </div>
      <table className="breakdown compact">
        <tbody>
          <Lines rows={nightRows(quote, lang)} />
        </tbody>
      </table>
      <p className="fine">
        {quote.taxes.length
          ? l("Taxes are added on the next step, before you pay.", "Los impuestos se agregan en el siguiente paso, antes de pagar.")
          : l("No taxes are added to this stay.", "Esta estadía no lleva impuestos.")}
      </p>
    </div>
  );
}

/** Step 2, at checkout: the full invoice. Taxes show as one line, like Airbnb. */
export function FullInvoice({ quote }: { quote: Quote }) {
  const { lang, l } = useL();
  return (
    <table className="breakdown invoice">
      <tbody>
        <Lines rows={nightRows(quote, lang)} />
        <tr className="subtotal">
          <th scope="row">{l("Total before taxes", "Total antes de impuestos")}</th>
          <td>{money(quote.subtotal)}</td>
        </tr>
        {quote.tax > 0 && (
          <tr className="tax">
            <th scope="row">{l("Taxes", "Impuestos")}</th>
            <td>{money(quote.tax)}</td>
          </tr>
        )}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">{l("Total due (USD)", "Total a pagar (USD)")}</th>
          <td>{money(quote.total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
