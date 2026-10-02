"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Settings } from "@/lib/types";
import { weekendRate } from "@/lib/pricing";
import { money } from "@/lib/format";

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (r.ok) router.refresh();
    else {
      setError((await r.json().catch(() => ({}))).error ?? "Sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <form className="guest-form admin-login" onSubmit={submit}>
      <label>
        Admin password
        <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <button className="pay" type="submit" disabled={busy}>
        {busy ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Form state: money as dollar strings, everything else as strings, so inputs
// can be edited freely. Converted back to cents on save.
type Form = Record<
  Exclude<keyof Settings, "weekendNights" | "directDiscountEnabled">,
  string
> & { weekendNights: number[]; directDiscountEnabled: boolean };

const MONEY: Array<keyof Settings> = ["baseNightly", "cleaningFee", "petFee"];

function toForm(s: Settings): Form {
  const f = {} as Record<string, unknown>;
  for (const [k, v] of Object.entries(s)) {
    if (k === "weekendNights" || k === "directDiscountEnabled") f[k] = v;
    else if (MONEY.includes(k as keyof Settings)) f[k] = ((v as number) / 100).toFixed(2);
    else f[k] = v === null ? "" : String(v);
  }
  return f as Form;
}

function fromForm(f: Form): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) {
    if (k === "weekendNights" || k === "directDiscountEnabled") out[k] = v;
    else if (MONEY.includes(k as keyof Settings)) out[k] = Math.round(Number(v) * 100);
    else if (k === "taxRatePercent") out[k] = v === "" ? null : Number(v);
    else out[k] = Number(v);
  }
  return out;
}

function Field(props: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  step?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">{props.label}</span>
      <span className="field-input">
        {props.prefix && <span className="affix">{props.prefix}</span>}
        <input
          inputMode="decimal"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
        />
        {props.suffix && <span className="affix">{props.suffix}</span>}
      </span>
      {props.hint && <span className="field-hint">{props.hint}</span>}
    </label>
  );
}

export function AdminSettings({ initial }: { initial: Settings }) {
  const [form, setForm] = useState<Form>(() => toForm(initial));
  const [saved, setSaved] = useState<Form>(() => toForm(initial));
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof Form) => (value: string) => {
    setForm({ ...form, [key]: value });
    setStatus(null);
  };
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const base = Math.round(Number(form.baseNightly) * 100) || 0;
  const weekend = weekendRate({ baseNightly: base, weekendMarkupPercent: Number(form.weekendMarkupPercent) || 0 });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const r = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fromForm(form)),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? "Settings couldn't be saved.");
      const next = toForm(body.settings);
      setForm(next);
      setSaved(next);
      setStatus({ kind: "ok", text: "Saved. The website uses the new settings now." });
    } catch (err) {
      setStatus({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={save}>
      {form.taxRatePercent === "" && (
        <p className="notice error" role="alert">
          Online booking is closed until you set the tax rate below. Enter 0 if you really don&apos;t collect tax.
        </p>
      )}

      <fieldset>
        <legend>Nightly price</legend>
        <Field label="Weeknight price" prefix="$" value={form.baseNightly} onChange={set("baseNightly")} />
        <Field label="Weekend increase" suffix="%" value={form.weekendMarkupPercent} onChange={set("weekendMarkupPercent")} />
        <div className="field">
          <span className="field-label">Weekend nights</span>
          <div className="day-picks">
            {DAYS.map((d, i) => (
              <label key={d} className="day-pick">
                <input
                  type="checkbox"
                  checked={form.weekendNights.includes(i)}
                  onChange={(e) => {
                    setStatus(null);
                    setForm({
                      ...form,
                      weekendNights: e.target.checked
                        ? [...form.weekendNights, i].sort()
                        : form.weekendNights.filter((n) => n !== i),
                    });
                  }}
                />
                {d}
              </label>
            ))}
          </div>
          <span className="field-hint">The night that starts on each checked day costs the weekend price.</span>
        </div>
        <p className="preview">
          Weeknights {money(base)}, weekend nights {money(weekend)}
        </p>
      </fieldset>

      <fieldset>
        <legend>Fees</legend>
        <Field label="Cleaning fee" hint="Per stay" prefix="$" value={form.cleaningFee} onChange={set("cleaningFee")} />
        <Field label="Pet fee" hint="Per stay, any number of pets" prefix="$" value={form.petFee} onChange={set("petFee")} />
      </fieldset>

      <fieldset>
        <legend>Discounts</legend>
        <Field label="Weekly discount" suffix="%" value={form.weeklyDiscountPercent} onChange={set("weeklyDiscountPercent")} />
        <Field label="Weekly starts at" suffix="nights" value={form.weeklyMinNights} onChange={set("weeklyMinNights")} />
        <Field label="Monthly discount" suffix="%" value={form.monthlyDiscountPercent} onChange={set("monthlyDiscountPercent")} />
        <Field label="Monthly starts at" suffix="nights" value={form.monthlyMinNights} onChange={set("monthlyMinNights")} />
        <div className="field toggle-field">
          <label className="toggle">
            <input
              type="checkbox"
              role="switch"
              checked={form.directDiscountEnabled}
              onChange={(e) => {
                setStatus(null);
                setForm({ ...form, directDiscountEnabled: e.target.checked });
              }}
            />
            <span>Direct booking discount {form.directDiscountEnabled ? "on" : "off"}</span>
          </label>
        </div>
        <Field label="Direct booking discount" suffix="%" value={form.directDiscountPercent} onChange={set("directDiscountPercent")} />
        <p className="field-hint wide">
          Weekly and monthly don&apos;t stack: the longer one applies. The direct booking discount applies on top of
          them. Discounts apply to the nights only, not to fees.
        </p>
      </fieldset>

      <fieldset>
        <legend>Guests and stays</legend>
        <Field label="Maximum guests" hint="Adults and children; infants don't count" value={form.maxGuests} onChange={set("maxGuests")} />
        <Field label="Maximum pets" hint="0 means no pets" value={form.maxPets} onChange={set("maxPets")} />
        <Field label="Longest online stay" suffix="nights" value={form.maxNights} onChange={set("maxNights")} />
        <Field
          label="Tax rate"
          suffix="%"
          hint="Total of state, county and tourist taxes, on nights and fees"
          value={form.taxRatePercent}
          onChange={set("taxRatePercent")}
        />
      </fieldset>

      <div className="admin-actions">
        <button className="pay" type="submit" disabled={busy || !dirty}>
          {busy ? "Saving…" : "Save settings"}
        </button>
        {status && (
          <p className={`notice ${status.kind === "error" ? "error" : ""}`} role="status">
            {status.text}
          </p>
        )}
      </div>
    </form>
  );
}
