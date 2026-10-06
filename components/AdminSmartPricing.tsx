"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SmartPricing } from "@/lib/types";
import type { NightPrice } from "@/lib/smart-pricing";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const toD = (c: number) => String(Math.round(c / 100));
const toC = (d: string) => Math.round(Number(d) * 100);

type Form = {
  enabled: boolean;
  months: Array<{ weekday: string; weekend: string }>;
  specials: Array<{ start: string; end: string; label: string; percent: string }>;
  lastMinute: Array<{ days: string; percent: string }>;
  gapFill: { enabled: boolean; maxNights: string; percent: string };
  demand: { enabled: boolean; threshold: string; percent: string };
  minPrice: string;
  maxPrice: string;
};

const toForm = (s: SmartPricing): Form => ({
  enabled: s.enabled,
  months: s.months.map((m) => ({ weekday: toD(m.weekday), weekend: toD(m.weekend) })),
  specials: s.specials.map((x) => ({ ...x, percent: String(x.percent) })),
  lastMinute: s.lastMinute.map((t) => ({ days: String(t.days), percent: String(t.percent) })),
  gapFill: { enabled: s.gapFill.enabled, maxNights: String(s.gapFill.maxNights), percent: String(s.gapFill.percent) },
  demand: { enabled: s.demand.enabled, threshold: String(s.demand.threshold), percent: String(s.demand.percent) },
  minPrice: toD(s.minPrice),
  maxPrice: toD(s.maxPrice),
});

const fromForm = (f: Form) => ({
  enabled: f.enabled,
  months: f.months.map((m) => ({ weekday: toC(m.weekday), weekend: toC(m.weekend) })),
  specials: f.specials.map((x) => ({ ...x, percent: Number(x.percent) })),
  lastMinute: f.lastMinute.filter((t) => t.days !== "" && t.percent !== "").map((t) => ({ days: Number(t.days), percent: Number(t.percent) })),
  gapFill: { enabled: f.gapFill.enabled, maxNights: Number(f.gapFill.maxNights), percent: Number(f.gapFill.percent) },
  demand: { enabled: f.demand.enabled, threshold: Number(f.demand.threshold), percent: Number(f.demand.percent) },
  minPrice: toC(f.minPrice),
  maxPrice: toC(f.maxPrice),
});

const REASON_LABEL: Record<string, string> = {
  special: "Special date",
  demand: "High demand",
  gap: "Gap between bookings",
  lastMinute: "Last minute",
  floor: "Lowest price",
  ceiling: "Highest price",
};

function Num(props: { value: string; onChange: (v: string) => void; prefix?: string; suffix?: string; label?: string }) {
  return (
    <span className="field-input small">
      {props.prefix && <span className="affix">{props.prefix}</span>}
      <input inputMode="decimal" aria-label={props.label} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
      {props.suffix && <span className="affix">{props.suffix}</span>}
    </span>
  );
}

export function AdminSmartPricing({
  initial,
  preview,
}: {
  initial: SmartPricing;
  preview: Array<NightPrice & { booked: boolean }> | null;
}) {
  const router = useRouter();
  const [f, setF] = useState<Form>(() => toForm(initial));
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const up = (patch: Partial<Form>) => {
    setF({ ...f, ...patch });
    setStatus(null);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/admin/smart-pricing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smartPricing: fromForm(f) }),
    });
    const body = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setStatus({ ok: false, text: body.error ?? "Couldn't save." });
    setF(toForm(body.smartPricing));
    setStatus({ ok: true, text: "Saved. The calendar and new quotes use these prices now." });
    router.refresh();
  }

  const months = preview
    ? preview.reduce<Record<string, typeof preview>>((acc, n) => {
        (acc[n.date.slice(0, 7)] ??= []).push(n);
        return acc;
      }, {})
    : {};

  return (
    <form className="admin-form smart" onSubmit={save}>
      <fieldset>
        <legend>Smart pricing</legend>
        <div className="field toggle-field wide">
          <label className="toggle">
            <input type="checkbox" role="switch" checked={f.enabled} onChange={(e) => up({ enabled: e.target.checked })} />
            <span>{f.enabled ? "On: prices follow the season and the calendar" : "Off: one weeknight and one weekend price"}</span>
          </label>
        </div>
        <p className="field-hint wide">
          Each night is priced as: its month price (weekday or weekend) → special dates → high demand → discounts to fill
          empty nights (gap or last minute, whichever is bigger) → kept between the lowest and highest price, rounded to $5.
          Length-of-stay, direct-booking and promo discounts still apply on top.
        </p>
      </fieldset>

      {f.enabled && (
        <>
          <fieldset>
            <legend>Price by month</legend>
            <div className="table-wrap wide">
              <table className="admin-table month-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Weeknight</th>
                    <th>Fri &amp; Sat</th>
                  </tr>
                </thead>
                <tbody>
                  {f.months.map((m, i) => (
                    <tr key={i}>
                      <th>{MONTHS[i]}</th>
                      {(["weekday", "weekend"] as const).map((kind) => (
                        <td key={kind}>
                          <Num
                            label={`${MONTHS[i]} ${kind}`}
                            prefix="$"
                            value={m[kind]}
                            onChange={(v) => up({ months: f.months.map((x, j) => (j === i ? { ...x, [kind]: v } : x)) })}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </fieldset>

          <fieldset>
            <legend>Special dates (events and holidays)</legend>
            <div className="tax-rows wide">
              {f.specials.map((x, i) => (
                <div className="special-row" key={i}>
                  <input value={x.label} aria-label="Name" placeholder="Name" onChange={(e) => up({ specials: f.specials.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)) })} />
                  <input type="date" aria-label="First night" value={x.start} onChange={(e) => up({ specials: f.specials.map((y, j) => (j === i ? { ...y, start: e.target.value } : y)) })} />
                  <input type="date" aria-label="Until (check-out day)" value={x.end} onChange={(e) => up({ specials: f.specials.map((y, j) => (j === i ? { ...y, end: e.target.value } : y)) })} />
                  <Num label="Change" suffix="%" value={x.percent} onChange={(v) => up({ specials: f.specials.map((y, j) => (j === i ? { ...y, percent: v } : y)) })} />
                  <button type="button" className="link" onClick={() => up({ specials: f.specials.filter((_, j) => j !== i) })}>
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" className="more-reviews" onClick={() => up({ specials: [...f.specials, { label: "", start: "", end: "", percent: "20" }] })}>
                Add special date
              </button>
            </div>
            <p className="field-hint wide">
              Dates are the first night and the check-out day. Use a negative % to lower prices (e.g. -10 for a slow week).
            </p>
          </fieldset>

          <fieldset>
            <legend>Filling empty nights</legend>
            <div className="field wide">
              <span className="field-label">Last-minute discounts</span>
              <div className="tiers">
                {f.lastMinute.map((t, i) => (
                  <span key={i} className="tier">
                    Within <Num label="Days" value={t.days} onChange={(v) => up({ lastMinute: f.lastMinute.map((y, j) => (j === i ? { ...y, days: v } : y)) })} /> days:{" "}
                    <Num label="Discount" suffix="%" value={t.percent} onChange={(v) => up({ lastMinute: f.lastMinute.map((y, j) => (j === i ? { ...y, percent: v } : y)) })} /> off
                  </span>
                ))}
              </div>
            </div>
            <div className="field">
              <label className="toggle">
                <input type="checkbox" checked={f.gapFill.enabled} onChange={(e) => up({ gapFill: { ...f.gapFill, enabled: e.target.checked } })} />
                <span>Gaps between bookings</span>
              </label>
              <span className="tier">
                Gaps of up to <Num label="Gap nights" value={f.gapFill.maxNights} onChange={(v) => up({ gapFill: { ...f.gapFill, maxNights: v } })} /> nights:{" "}
                <Num label="Gap discount" suffix="%" value={f.gapFill.percent} onChange={(v) => up({ gapFill: { ...f.gapFill, percent: v } })} /> off
              </span>
              <span className="field-hint">Gaps shorter than the minimum stay can be booked exactly, so they don't stay empty.</span>
            </div>
            <div className="field">
              <label className="toggle">
                <input type="checkbox" checked={f.demand.enabled} onChange={(e) => up({ demand: { ...f.demand, enabled: e.target.checked } })} />
                <span>High demand</span>
              </label>
              <span className="tier">
                If <Num label="Booked share" suffix="%" value={f.demand.threshold} onChange={(v) => up({ demand: { ...f.demand, threshold: v } })} /> of the 2 weeks around a night are booked:{" "}
                +<Num label="Demand increase" suffix="%" value={f.demand.percent} onChange={(v) => up({ demand: { ...f.demand, percent: v } })} />
              </span>
            </div>
            <div className="field">
              <span className="field-label">Limits</span>
              <span className="tier">
                Never below <Num label="Lowest" prefix="$" value={f.minPrice} onChange={(v) => up({ minPrice: v })} /> or above{" "}
                <Num label="Highest" prefix="$" value={f.maxPrice} onChange={(v) => up({ maxPrice: v })} /> a night
              </span>
            </div>
          </fieldset>
        </>
      )}

      <div className="admin-actions">
        <button className="pay" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save smart pricing"}
        </button>
        {status && <p className={`notice ${status.ok ? "" : "error"}`}>{status.text}</p>}
      </div>

      {f.enabled && preview && (
        <fieldset>
          <legend>Next 90 days, as guests see them</legend>
          <div className="preview-months wide">
            {Object.entries(months).map(([month, nights]) => (
              <div key={month}>
                <strong>{new Date(`${month}-15T12:00:00Z`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</strong>
                <div className="preview-grid">
                  {nights.map((n) => {
                    const tags = n.reasons.filter((r) => REASON_LABEL[r]);
                    return (
                      <span
                        key={n.date}
                        className={`pv ${n.booked ? "booked" : n.price < n.regular ? "deal" : n.reasons.includes("special") || n.reasons.includes("demand") ? "up" : ""}`}
                        title={`${n.date}: ${n.booked ? "booked" : `$${n.price / 100}`}${n.special ? ` (${n.special})` : ""}${tags.length ? ` · ${tags.map((t) => REASON_LABEL[t]).join(", ")}` : ""}`}
                      >
                        <b>{Number(n.date.slice(8))}</b>
                        {n.booked ? "—" : `$${n.price / 100}`}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="field-hint wide">
            Coral: discounted to fill (last minute or gap). Blue: raised (special date or high demand). Grey: booked. Hover a
            day to see why.
          </p>
        </fieldset>
      )}
    </form>
  );
}
