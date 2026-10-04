"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Settings } from "@/lib/types";
import type { PublicReview } from "@/lib/reviews";
import { weekendRate } from "@/lib/pricing";
import { POLICIES, POLICY_IDS } from "@/lib/policy";
import { CodeInput } from "./AuthPanel";
import { money } from "@/lib/format";

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"password" | "code">("password");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await fetch(step === "password" ? "/api/admin/login" : "/api/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(step === "password" ? { password } : { code }),
    });
    const body = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(body.error ?? "Sign-in failed.");
    if (body.needsCode) {
      setStep("code");
      return;
    }
    router.refresh();
  }

  return (
    <form className="guest-form admin-login" onSubmit={submit}>
      {step === "password" ? (
        <label>
          Admin password
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
      ) : (
        <>
          <p className="auth-intro">We emailed a 6-digit code to the admin email.</p>
          <CodeInput value={code} onChange={setCode} />
        </>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <button className="pay" type="submit" disabled={busy}>
        {busy ? "Checking…" : step === "password" ? "Continue" : "Sign in"}
      </button>
    </form>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Form state: money as dollar strings, everything else as strings, so inputs
// can be edited freely. Converted back to cents on save.
type TaxRow = { name: string; percent: string };

type Form = Record<
  Exclude<keyof Settings, "weekendNights" | "directDiscountEnabled" | "icalUrls" | "taxes" | "cancellationPolicy">,
  string
> & {
  weekendNights: number[];
  directDiscountEnabled: boolean;
  icalUrls: string;
  taxes: TaxRow[];
  /** false while taxes were never saved (booking closed) */
  taxesConfigured: boolean;
  cancellationPolicy: Settings["cancellationPolicy"];
};

// Names only: the rates depend on the county and must be confirmed by the owner.
const SUGGESTED_TAXES: TaxRow[] = [
  { name: "Florida sales tax", percent: "" },
  { name: "County discretionary sales surtax", percent: "" },
  { name: "Tourist development tax", percent: "" },
];

const MONEY: Array<keyof Settings> = ["baseNightly", "cleaningFee", "petFee"];

function toForm(s: Settings): Form {
  const f = {} as Record<string, unknown>;
  for (const [k, v] of Object.entries(s)) {
    if (k === "weekendNights" || k === "directDiscountEnabled" || k === "cancellationPolicy") f[k] = v;
    else if (k === "icalUrls") f[k] = (v as string[]).join("\n");
    else if (k === "taxes") {
      f.taxesConfigured = v !== null;
      f.taxes = v === null ? SUGGESTED_TAXES : (v as Settings["taxes"])!.map((t) => ({ name: t.name, percent: String(t.percent) }));
    }
    else if (MONEY.includes(k as keyof Settings)) f[k] = ((v as number) / 100).toFixed(2);
    else f[k] = v === null ? "" : String(v);
  }
  return f as Form;
}

function fromForm(f: Form): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) {
    if (k === "weekendNights" || k === "directDiscountEnabled" || k === "cancellationPolicy") out[k] = v;
    else if (k === "taxesConfigured") continue;
    else if (
      ["contactWhatsApp", "contactPhone", "contactEmail", "propertyAddress", "checkInInstructions", "approxArea", "mapCenter"].includes(k)
    )
      out[k] = v;
    else if (k === "taxes") {
      const rows = v as TaxRow[];
      // Untouched suggestions keep booking closed instead of failing validation.
      out[k] = !f.taxesConfigured && rows.every((r) => r.percent.trim() === "") ? null : rows;
    } else if (k === "icalUrls") out[k] = String(v).split(/\s+/).filter(Boolean);
    else if (k === "reviewsPlatform") out[k] = v;
    else if (MONEY.includes(k as keyof Settings)) out[k] = Math.round(Number(v) * 100);
    else if (k === "reviewsAverage" || k === "reviewsCount") out[k] = v === "" ? null : Number(v);
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
      {!form.taxesConfigured && (
        <p className="notice error" role="alert">
          Online booking is closed until you fill in the Florida taxes below and save.
        </p>
      )}

      <fieldset>
        <legend>Calendars</legend>
        <label className="field wide-field">
          <span className="field-label">Calendar links (one per line)</span>
          <textarea
            rows={3}
            spellCheck={false}
            value={form.icalUrls}
            placeholder={"https://www.airbnb.com/calendar/ical/....ics\nhttps://www.vrbo.com/icalendar/....ics"}
            onChange={(e) => {
              setStatus(null);
              setForm({ ...form, icalUrls: e.target.value });
            }}
          />
          <span className="field-hint">
            Best: the Hospitable export link (Properties → your property → Export calendar → Copy iCal link) plus
            the Airbnb export link, which also carries dates you blocked by hand. Nights busy in any of them show as
            booked here.
          </span>
        </label>
        <Field label="Minimum stay" suffix="nights" value={form.minNights} onChange={set("minNights")} />
      </fieldset>

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
      </fieldset>

      <fieldset>
        <legend>Florida taxes</legend>
        <div className="tax-rows wide">
          {form.taxes.map((t, i) => (
            <div className="tax-row" key={i}>
              <label className="field">
                <span className="field-label">Tax name</span>
                <span className="field-input">
                  <input
                    value={t.name}
                    onChange={(e) => {
                      setStatus(null);
                      setForm({ ...form, taxes: form.taxes.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)) });
                    }}
                  />
                </span>
              </label>
              <label className="field">
                <span className="field-label">Rate</span>
                <span className="field-input">
                  <input
                    inputMode="decimal"
                    value={t.percent}
                    onChange={(e) => {
                      setStatus(null);
                      setForm({
                        ...form,
                        taxes: form.taxes.map((r, j) => (j === i ? { ...r, percent: e.target.value } : r)),
                      });
                    }}
                  />
                  <span className="affix">%</span>
                </span>
              </label>
              <button
                type="button"
                className="link"
                onClick={() => {
                  setStatus(null);
                  setForm({ ...form, taxesConfigured: true, taxes: form.taxes.filter((_, j) => j !== i) });
                }}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="more-reviews"
            disabled={form.taxes.length >= 6}
            onClick={() => setForm({ ...form, taxes: [...form.taxes, { name: "", percent: "" }] })}
          >
            Add tax line
          </button>
        </div>
        <p className="field-hint wide">
          Charged on the nights, cleaning fee and pet fee. Guests see them added together as one "Taxes" line; each
          line is kept separately in the bookings for your tax filings. Rates
          depend on the county: confirm them with the Florida Department of Revenue and your county tax collector.
          Remove every line only if you don&apos;t collect taxes on these bookings.
        </p>
      </fieldset>

      <fieldset>
        <legend>Cancellation policy and check-in</legend>
        <label className="field wide-field">
          <span className="field-label">Policy for new bookings</span>
          <span className="field-input">
            <select
              value={form.cancellationPolicy}
              onChange={(e) => {
                setStatus(null);
                setForm({ ...form, cancellationPolicy: e.target.value as Settings["cancellationPolicy"] });
              }}
            >
              {POLICY_IDS.map((id) => (
                <option key={id} value={id}>
                  {POLICIES[id].name}
                </option>
              ))}
            </select>
          </span>
          <span className="field-hint">
            {POLICIES[form.cancellationPolicy].summary} Choose the same one you use on Airbnb. Existing bookings keep the
            policy they were booked with.
          </span>
        </label>
        <Field label="Check-in from" suffix=":00 (24h)" hint="Deadlines count from this time" value={form.checkInHour} onChange={set("checkInHour")} />
        <Field label="Check-out by" suffix=":00 (24h)" value={form.checkOutHour} onChange={set("checkOutHour")} />
      </fieldset>

      <fieldset>
        <legend>Address and check-in</legend>
        <label className="field wide-field">
          <span className="field-label">Exact address (private)</span>
          <span className="field-input">
            <input value={form.propertyAddress} onChange={(e) => set("propertyAddress")(e.target.value)} />
          </span>
          <span className="field-hint">
            Guests only see it on their trip page, starting on their check-in day. It&apos;s never on the public site.
          </span>
        </label>
        <label className="field wide-field">
          <span className="field-label">Check-in instructions (private)</span>
          <textarea
            rows={5}
            value={form.checkInInstructions}
            placeholder={"Door code, where to park, wifi name and password, trash day…"}
            onChange={(e) => set("checkInInstructions")(e.target.value)}
          />
          <span className="field-hint">Shown together with the address, from check-in day.</span>
        </label>
        <label className="field wide-field">
          <span className="field-label">Area shown on the public map</span>
          <span className="field-input">
            <input value={form.approxArea} onChange={(e) => set("approxArea")(e.target.value)} />
          </span>
          <span className="field-hint">A neighborhood or area name shown next to the map, never the street address.</span>
        </label>
        <label className="field wide-field">
          <span className="field-label">Map center (approximate)</span>
          <span className="field-input">
            <input value={form.mapCenter} placeholder="28.012, -82.570" onChange={(e) => set("mapCenter")(e.target.value)} />
          </span>
          <span className="field-hint">
            In Google Maps, right-click a spot a few blocks from the house (on the water or a nearby street, not the
            house itself) and click the numbers at the top of the menu to copy them. Paste here. The site rounds them
            to about 100 m and shows a circle, like Airbnb. Leave empty to center on the area name.
          </span>
        </label>
        <Field label="Map zoom" hint="14 = neighborhood, 15 = closer, 13 = wider" value={form.mapZoom} onChange={set("mapZoom")} />
      </fieldset>

      <fieldset>
        <legend>Chat button</legend>
        <label className="field">
          <span className="field-label">WhatsApp number</span>
          <span className="field-input">
            <input value={form.contactWhatsApp} placeholder="+1 813 555 0100" onChange={(e) => set("contactWhatsApp")(e.target.value)} />
          </span>
        </label>
        <label className="field">
          <span className="field-label">Phone for texts</span>
          <span className="field-input">
            <input value={form.contactPhone} placeholder="+1 813 555 0100" onChange={(e) => set("contactPhone")(e.target.value)} />
          </span>
        </label>
        <label className="field">
          <span className="field-label">Email</span>
          <span className="field-input">
            <input type="email" value={form.contactEmail} onChange={(e) => set("contactEmail")(e.target.value)} />
          </span>
        </label>
        <p className="field-hint wide">The floating chat button appears on the site once at least one of these is filled in.</p>
      </fieldset>

      <fieldset>
        <legend>Reviews summary</legend>
        <Field label="Overall rating" hint="As shown on your listing, e.g. 4.92" suffix="★" value={form.reviewsAverage} onChange={set("reviewsAverage")} />
        <Field label="Number of reviews" value={form.reviewsCount} onChange={set("reviewsCount")} />
        <label className="field">
          <span className="field-label">Platform</span>
          <span className="field-input">
            <input value={form.reviewsPlatform} onChange={(e) => set("reviewsPlatform")(e.target.value)} />
          </span>
        </label>
        <p className="field-hint wide">Leave the rating empty to hide it. Copy the real numbers from the listing.</p>
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


export function AdminReviews({ initial }: { initial: PublicReview[] }) {
  const [reviews, setReviews] = useState(initial);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const empty = { name: "", month: thisMonth, platform: "Airbnb", rating: "5", text: "" };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await fetch("/api/admin/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, rating: Number(form.rating) }),
    });
    const body = await r.json();
    setBusy(false);
    if (!r.ok) return setError(body.error ?? "The review couldn't be saved.");
    setReviews([body.review, ...reviews].sort((a, b) => b.month.localeCompare(a.month)));
    setForm({ ...empty, platform: form.platform });
  }

  async function remove(id: string) {
    if (!confirm("Remove this review from the site?")) return;
    await fetch(`/api/admin/reviews?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setReviews(reviews.filter((r) => r.id !== id));
  }

  return (
    <div className="admin-reviews">
      <form className="admin-form" onSubmit={add}>
        <fieldset>
          <legend>Add a review</legend>
          <label className="field">
            <span className="field-label">Guest name</span>
            <span className="field-input">
              <input value={form.name} placeholder="Maria G." onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </span>
            <span className="field-hint">First name and initial is enough</span>
          </label>
          <label className="field">
            <span className="field-label">Month</span>
            <span className="field-input">
              <input type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} />
            </span>
          </label>
          <label className="field">
            <span className="field-label">Platform</span>
            <span className="field-input">
              <input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} />
            </span>
          </label>
          <label className="field">
            <span className="field-label">Stars</span>
            <span className="field-input">
              <select value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label className="field wide-field">
            <span className="field-label">Review text</span>
            <textarea rows={4} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
            <span className="field-hint">
              Paste it exactly as the guest wrote it. Add recent reviews as they come in, not only the best ones.
            </span>
          </label>
          {error && (
            <p className="notice error wide" role="alert">
              {error}
            </p>
          )}
          <div className="wide">
            <button className="pay" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Add review"}
            </button>
          </div>
        </fieldset>
      </form>

      {reviews.length > 0 && (
        <ul className="admin-review-list">
          {reviews.map((r) => (
            <li key={r.id}>
              <div>
                <strong>{r.name}</strong> · {r.month} · {r.platform} · {r.rating}★
                <p>{r.text.length > 180 ? `${r.text.slice(0, 180)}…` : r.text}</p>
              </div>
              <button type="button" className="link" onClick={() => remove(r.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-field">
      <input readOnly value={value} onFocus={(e) => e.target.select()} aria-label="Calendar link" />
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function AdminCancel({ code }: { code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run(full: boolean) {
    const text = full
      ? `Cancel ${code} and refund everything the guest paid?`
      : `Cancel ${code} and refund what the cancellation policy allows?`;
    if (!window.confirm(text)) return;
    setBusy(true);
    const r = await fetch(`/api/admin/trips/${encodeURIComponent(code)}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full }),
    });
    const body = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return window.alert(body.error ?? "Couldn't cancel.");
    window.alert(`Cancelled. Refunded ${money(body.refunded ?? 0)}.`);
    router.refresh();
  }
  return (
    <div className="admin-cancel">
      <button type="button" className="link" disabled={busy} onClick={() => run(false)}>
        Cancel (policy)
      </button>
      <button type="button" className="link" disabled={busy} onClick={() => run(true)}>
        Cancel (full refund)
      </button>
    </div>
  );
}
