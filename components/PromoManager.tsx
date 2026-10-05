"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PromoStats } from "@/lib/promos";
import { money } from "@/lib/format";
import { CopyField } from "./Admin";

type Form = {
  id?: string;
  code: string;
  influencer: string;
  contact: string;
  guestPercent: string;
  commissionPercent: string;
  redeemFrom: string;
  redeemTo: string;
  stayFrom: string;
  stayTo: string;
  maxUses: string;
  active: boolean;
};

const EMPTY: Form = {
  code: "",
  influencer: "",
  contact: "",
  guestPercent: "5",
  commissionPercent: "3",
  redeemFrom: "",
  redeemTo: "",
  stayFrom: "",
  stayTo: "",
  maxUses: "",
  active: true,
};

const toForm = (p: PromoStats): Form => ({
  id: p.id,
  code: p.code,
  influencer: p.influencer,
  contact: p.contact,
  guestPercent: String(p.guestPercent),
  commissionPercent: String(p.commissionPercent),
  redeemFrom: p.redeemFrom ?? "",
  redeemTo: p.redeemTo ?? "",
  stayFrom: p.stayFrom ?? "",
  stayTo: p.stayTo ?? "",
  maxUses: p.maxUses === null ? "" : String(p.maxUses),
  active: p.active,
});

function status(p: PromoStats, today: string): { text: string; kind: "ok" | "off" | "soon" } {
  if (!p.active) return { text: "Paused", kind: "off" };
  if (p.redeemTo && today > p.redeemTo) return { text: "Expired", kind: "off" };
  if (p.redeemFrom && today < p.redeemFrom) return { text: "Starts later", kind: "soon" };
  if (p.maxUses !== null && p.bookings >= p.maxUses) return { text: "Used up", kind: "off" };
  return { text: "Active", kind: "ok" };
}

const fmt = (d: string | null) =>
  d
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
        new Date(`${d}T12:00:00Z`),
      )
    : null;

const range = (a: string | null, b: string | null) =>
  a && b ? `${fmt(a)} – ${fmt(b)}` : a ? `from ${fmt(a)}` : b ? `until ${fmt(b)}` : "any time";

export function PromoManager({ initial, siteUrl, today }: { initial: PromoStats[]; siteUrl: string; today: string }) {
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(form && { ...form, [k]: k === "code" ? e.target.value.toUpperCase() : e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    const r = await fetch("/api/admin/promos", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(body.error ?? "Couldn't save.");
    setForm(null);
    router.refresh();
  }

  const totals = initial.reduce(
    (a, p) => ({ bookings: a.bookings + p.bookings, sales: a.sales + p.sales, commission: a.commission + p.commission }),
    { bookings: 0, sales: 0, commission: 0 },
  );

  return (
    <div className="promos">
      {!form && (
        <button type="button" className="pay new-promo" onClick={() => setForm({ ...EMPTY })}>
          New influencer code
        </button>
      )}

      {form && (
        <form className="admin-form" onSubmit={save}>
          <fieldset>
            <legend>{form.id ? `Edit ${form.code}` : "New influencer code"}</legend>
            <label className="field">
              <span className="field-label">Code</span>
              <span className="field-input">
                <input value={form.code} onChange={set("code")} placeholder="MARIA5" readOnly={Boolean(form.id)} maxLength={24} />
              </span>
              <span className="field-hint">{form.id ? "Codes can't be renamed." : "What the influencer shares. Letters and numbers."}</span>
            </label>
            <label className="field">
              <span className="field-label">Influencer</span>
              <span className="field-input">
                <input value={form.influencer} onChange={set("influencer")} placeholder="Maria Gomez" />
              </span>
            </label>
            <label className="field">
              <span className="field-label">Contact (optional)</span>
              <span className="field-input">
                <input value={form.contact} onChange={set("contact")} placeholder="@maria, email or phone" />
              </span>
            </label>
            <label className="field">
              <span className="field-label">Guest discount</span>
              <span className="field-input">
                <input inputMode="decimal" value={form.guestPercent} onChange={set("guestPercent")} />
                <span className="affix">%</span>
              </span>
              <span className="field-hint">Extra discount on the nights, on top of the others.</span>
            </label>
            <label className="field">
              <span className="field-label">Influencer commission</span>
              <span className="field-input">
                <input inputMode="decimal" value={form.commissionPercent} onChange={set("commissionPercent")} />
                <span className="affix">%</span>
              </span>
              <span className="field-hint">Of the sale before taxes.</span>
            </label>
            <label className="field">
              <span className="field-label">Max bookings (optional)</span>
              <span className="field-input">
                <input inputMode="numeric" value={form.maxUses} onChange={set("maxUses")} placeholder="No limit" />
              </span>
            </label>
            <label className="field">
              <span className="field-label">Code works from</span>
              <span className="field-input">
                <input type="date" value={form.redeemFrom} onChange={set("redeemFrom")} />
              </span>
            </label>
            <label className="field">
              <span className="field-label">Code works until</span>
              <span className="field-input">
                <input type="date" value={form.redeemTo} onChange={set("redeemTo")} />
              </span>
              <span className="field-hint">Leave empty for no end date.</span>
            </label>
            <label className="field">
              <span className="field-label">For check-ins from</span>
              <span className="field-input">
                <input type="date" value={form.stayFrom} onChange={set("stayFrom")} />
              </span>
            </label>
            <label className="field">
              <span className="field-label">For check-ins until</span>
              <span className="field-input">
                <input type="date" value={form.stayTo} onChange={set("stayTo")} />
              </span>
              <span className="field-hint">Limit which trip dates the code is for, or leave empty.</span>
            </label>
            <div className="field toggle-field">
              <label className="toggle">
                <input type="checkbox" role="switch" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                <span>{form.active ? "Active" : "Paused"}</span>
              </label>
            </div>
            {error && (
              <p className="notice error wide" role="alert">
                {error}
              </p>
            )}
            <div className="wide admin-actions">
              <button className="pay" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save code"}
              </button>
              <button type="button" className="link" onClick={() => setForm(null)}>
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      )}

      {initial.length > 0 ? (
        <>
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Influencer</th>
                  <th>Discount / commission</th>
                  <th>When</th>
                  <th>Bookings</th>
                  <th>Sales</th>
                  <th>Commission owed</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {initial.map((p) => {
                  const st = status(p, today);
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.code}</strong>
                        <br />
                        <span className={`pill ${st.kind}`}>{st.text}</span>
                      </td>
                      <td>
                        {p.influencer}
                        {p.contact && (
                          <>
                            <br />
                            <span className="fine">{p.contact}</span>
                          </>
                        )}
                      </td>
                      <td>
                        {p.guestPercent}% / {p.commissionPercent}%
                      </td>
                      <td className="fine">
                        Code: {range(p.redeemFrom, p.redeemTo)}
                        <br />
                        Stays: {range(p.stayFrom, p.stayTo)}
                        {p.maxUses !== null && (
                          <>
                            <br />
                            Max {p.maxUses} bookings
                          </>
                        )}
                      </td>
                      <td>{p.bookings}</td>
                      <td>{money(p.sales)}</td>
                      <td>
                        <strong>{money(p.commission)}</strong>
                      </td>
                      <td>
                        <button type="button" className="link" onClick={() => setForm(toForm(p))}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={4}>Total</th>
                  <th>{totals.bookings}</th>
                  <th>{money(totals.sales)}</th>
                  <th>{money(totals.commission)}</th>
                  <th></th>
                </tr>
              </tfoot>
            </table>
          </div>

          <h2 className="admin-section">Links to share</h2>
          <p className="fine">
            Each link opens the site with the code already filled in, and its visits show up in Analytics under the
            influencer&apos;s code.
          </p>
          <div className="promo-links">
            {initial
              .filter((p) => status(p, today).kind !== "off")
              .map((p) => (
                <div key={p.id}>
                  <span className="field-label">{p.code}</span>
                  <CopyField value={`${siteUrl}/?promo=${p.code}&utm_source=influencer&utm_campaign=${p.code}`} />
                </div>
              ))}
          </div>
        </>
      ) : (
        !form && <p className="fine">No codes yet.</p>
      )}
    </div>
  );
}
