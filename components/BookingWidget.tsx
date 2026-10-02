"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Month } from "./Calendar";
import { SquareCard, type SquareCardHandle } from "./SquareCard";
import { AuthPanel } from "./AuthPanel";
import type { BookResult, PublicDay, PublicSettings, PublicUser, Quote } from "@/lib/types";
import { longDate, money } from "@/lib/format";

type Props = { settings: PublicSettings; user: PublicUser | null };

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function Stepper(props: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const { label, hint, value, min, max, onChange } = props;
  return (
    <div className="stepper">
      <div>
        <div className="stepper-label">{label}</div>
        {hint && <div className="stepper-hint">{hint}</div>}
      </div>
      <div className="stepper-controls">
        <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          −
        </button>
        <span aria-live="polite">{value}</span>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
          +
        </button>
      </div>
    </div>
  );
}

function Breakdown({ quote }: { quote: Quote }) {
  const rows: Array<[string, number]> = [];
  if (quote.weekdayNights) {
    rows.push([`${money(quote.weekdayRate)} × ${quote.weekdayNights} ${quote.weekdayNights === 1 ? "night" : "nights"}`, quote.weekdayNights * quote.weekdayRate]);
  }
  if (quote.weekendNights) {
    rows.push([`${money(quote.weekendRate)} × ${quote.weekendNights} weekend ${quote.weekendNights === 1 ? "night" : "nights"}`, quote.weekendNights * quote.weekendRate]);
  }
  if (quote.lengthDiscount) rows.push([`${quote.lengthDiscount.label} (${quote.lengthDiscount.percent}%)`, -quote.lengthDiscount.amount]);
  if (quote.directDiscount) rows.push([`Direct booking discount (${quote.directDiscount.percent}%)`, -quote.directDiscount.amount]);
  if (quote.cleaningFee) rows.push(["Cleaning fee", quote.cleaningFee]);
  if (quote.petFee) rows.push(["Pet fee", quote.petFee]);
  if (quote.tax) rows.push(["Taxes", quote.tax]);

  return (
    <table className="breakdown">
      <tbody>
        {rows.map(([label, amount]) => (
          <tr key={label} className={amount < 0 ? "discount" : undefined}>
            <th scope="row">{label}</th>
            <td>{amount < 0 ? `−${money(-amount)}` : money(amount)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">Total</th>
          <td>{money(quote.total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

export function BookingWidget({ settings, user }: Props) {
  const params = useSearchParams();

  const [days, setDays] = useState<PublicDay[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checkIn, setCheckIn] = useState<string | null>(params.get("checkIn"));
  const [checkOut, setCheckOut] = useState<string | null>(params.get("checkOut"));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [pets, setPets] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);

  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Extract<BookResult, { state: "confirmed" }> | null>(null);
  const cardRef = useRef<SquareCardHandle>(null);

  const loadDays = useCallback(() => {
    fetch("/api/availability")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "Availability couldn't be loaded.");
        setDays(body.days);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);
  useEffect(loadDays, [loadDays]);

  const dayMap = useMemo(() => new Map((days ?? []).map((d) => [d.date, d])), [days]);
  const today = days?.[0]?.date ?? new Date().toISOString().slice(0, 10);
  const lastDate = days?.[days.length - 1]?.date ?? today;

  const canCheckIn = useCallback(
    (date: string) => {
      const d = dayMap.get(date);
      return Boolean(d && d.available && !d.closedForCheckin);
    },
    [dayMap],
  );

  const nightsFree = useCallback(
    (from: string, to: string) => {
      for (let d = from; d < to; d = addDays(d, 1)) if (!dayMap.get(d)?.available) return false;
      return true;
    },
    [dayMap],
  );

  const canCheckOut = useCallback(
    (date: string) => {
      if (!checkIn || date <= checkIn) return false;
      if (dayMap.get(date)?.closedForCheckout) return false;
      return nightsFree(checkIn, date);
    },
    [checkIn, dayMap, nightsFree],
  );

  const choosingCheckOut = Boolean(checkIn && !checkOut);
  const isSelectable = useCallback(
    (date: string) => (choosingCheckOut ? canCheckOut(date) || canCheckIn(date) : canCheckIn(date)),
    [choosingCheckOut, canCheckIn, canCheckOut],
  );

  function select(date: string) {
    if (!checkIn || checkOut || date <= checkIn) {
      if (canCheckIn(date)) {
        setCheckIn(date);
        setCheckOut(null);
      }
      return;
    }
    if (canCheckOut(date)) setCheckOut(date);
    else if (canCheckIn(date)) setCheckIn(date);
  }

  // Price the stay whenever dates or guests change.
  useEffect(() => {
    setQuote(null);
    setQuoteError(null);
    setPayError(null);
    if (!checkIn || !checkOut) return;
    const ctrl = new AbortController();
    setQuoting(true);
    fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkIn, checkOut, adults, children, infants, pets }),
      signal: ctrl.signal,
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) setQuoteError(body.error ?? "The price couldn't be calculated.");
        else setQuote(body.quote);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setQuoteError("The price couldn't be calculated. Try again.");
      })
      .finally(() => setQuoting(false));
    return () => ctrl.abort();
  }, [checkIn, checkOut, adults, children, infants, pets]);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!quote || !cardRef.current || !user) return;
    setPaying(true);
    setPayError(null);
    try {
      const sourceId = await cardRef.current.tokenize(quote.total, {
        givenName: user.firstName,
        familyName: user.lastName,
        email: user.email,
        phone: user.phone || undefined,
      });
      const r = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkIn,
          checkOut,
          adults,
          children,
          infants,
          pets,
          sourceId,
          idempotencyKey: crypto.randomUUID(),
          expectedTotal: quote.total,
        }),
      });
      const result: BookResult = await r.json();
      if (result.state === "confirmed") {
        setBooked(result);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (result.state === "price_changed") setQuote(result.quote);
      if (result.state === "released") loadDays();
      setPayError(result.message);
    } catch (err) {
      setPayError((err as Error).message || "Payment couldn't be completed. Try again.");
    } finally {
      setPaying(false);
    }
  }

  if (booked) {
    return (
      <section className="status ok" aria-live="polite">
        <h2>You&apos;re booked, {booked.firstName}.</h2>
        <p className="big-dates">
          {longDate(booked.quote.checkIn)} to {longDate(booked.quote.checkOut)}
        </p>
        <p>
          Paid {money(booked.quote.total)}. Confirmation code <strong>{booked.code}</strong>.
        </p>
        <p>
          Your trip is saved in <a href="/account">your account</a>. Check-in details will be sent to {user?.email}{" "}
          before your arrival.
        </p>
      </section>
    );
  }

  const base = new Date(`${today}T00:00:00Z`);
  const months = [0, 1].map((i) => {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + monthOffset + i, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  });
  const lastShown = new Date(Date.UTC(months[1].year, months[1].month + 1, 0)).toISOString().slice(0, 10);

  const minStayHint =
    checkIn && !checkOut && (dayMap.get(checkIn)?.minStay ?? 1) > 1
      ? `Stays from ${longDate(checkIn)} need at least ${dayMap.get(checkIn)!.minStay} nights.`
      : null;

  const perks: string[] = [];
  if (settings.directDiscountEnabled && settings.directDiscountPercent > 0) {
    perks.push(`${settings.directDiscountPercent}% off for booking here`);
  }
  if (settings.weeklyDiscountPercent > 0) perks.push(`${settings.weeklyDiscountPercent}% off ${settings.weeklyMinNights}+ nights`);
  if (settings.monthlyDiscountPercent > 0) perks.push(`${settings.monthlyDiscountPercent}% off ${settings.monthlyMinNights}+ nights`);

  return (
    <div className="booking">
      <section className="calendar-panel" aria-labelledby="dates-heading">
        <div className="calendar-head">
          <h2 id="dates-heading">
            {!checkIn ? "Pick your check-in day" : !checkOut ? "Now pick your check-out day" : "Your dates"}
          </h2>
          <div className="calendar-nav">
            <button type="button" aria-label="Previous months" disabled={monthOffset === 0} onClick={() => setMonthOffset((m) => Math.max(0, m - 2))}>
              ‹
            </button>
            <button type="button" aria-label="Next months" disabled={lastShown >= lastDate} onClick={() => setMonthOffset((m) => m + 2)}>
              ›
            </button>
          </div>
        </div>

        {loadError ? (
          <p className="notice error" role="alert">
            {loadError} Refresh the page to try again.
          </p>
        ) : !days ? (
          <p className="notice">Loading availability…</p>
        ) : (
          <>
            <div className="months">
              {months.map((m) => (
                <Month
                  key={`${m.year}-${m.month}`}
                  {...m}
                  dayMap={dayMap}
                  today={today}
                  checkIn={checkIn}
                  checkOut={checkOut}
                  isSelectable={isSelectable}
                  onSelect={select}
                />
              ))}
            </div>
            <div className="legend" aria-hidden="true">
              <span>
                <i className="swatch open" /> Open, nightly price below the date
              </span>
              <span>
                <i className="swatch taken" /> Booked
              </span>
            </div>
            {minStayHint && <p className="notice">{minStayHint}</p>}
          </>
        )}
      </section>

      <aside className="summary" aria-label="Your booking">
        {perks.length > 0 && (
          <ul className="perks">
            {perks.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}

        <dl className="dates">
          <div>
            <dt>Check-in</dt>
            <dd>{checkIn ? longDate(checkIn) : "Add date"}</dd>
          </div>
          <div>
            <dt>Check-out</dt>
            <dd>{checkOut ? longDate(checkOut) : "Add date"}</dd>
          </div>
        </dl>
        {checkIn && (
          <button
            type="button"
            className="link"
            onClick={() => {
              setCheckIn(null);
              setCheckOut(null);
            }}
          >
            Clear dates
          </button>
        )}

        <div className="guests">
          <Stepper label="Adults" value={adults} min={1} max={settings.maxGuests - children} onChange={setAdults} />
          <Stepper label="Children" hint="Ages 2–12" value={children} min={0} max={Math.max(0, settings.maxGuests - adults)} onChange={setChildren} />
          <Stepper label="Infants" hint="Under 2" value={infants} min={0} max={5} onChange={setInfants} />
          {settings.maxPets > 0 && (
            <Stepper
              label="Pets"
              hint={`${money(settings.petFee)} per stay`}
              value={pets}
              min={0}
              max={settings.maxPets}
              onChange={setPets}
            />
          )}
        </div>
        <p className="fine">Up to {settings.maxGuests} guests, not counting infants.</p>

        {!settings.bookingOpen && <p className="notice">Online booking opens soon.</p>}
        {quoting && <p className="notice">Calculating your total…</p>}
        {quoteError && (
          <p className="notice error" role="alert">
            {quoteError}
          </p>
        )}

        {quote && (
          <>
            <Breakdown quote={quote} />
            {!user ? (
              <AuthPanel intro="Create an account or sign in to book. Your trips will be saved there." />
            ) : (
              <form className="guest-form" onSubmit={pay}>
                <p className="booking-as">
                  Booking as{" "}
                  <strong>
                    {user.firstName} {user.lastName}
                  </strong>
                  <br />
                  {user.email}
                </p>
                <SquareCard ref={cardRef} />
                {payError && (
                  <p className="notice error" role="alert">
                    {payError}
                  </p>
                )}
                <button className="pay" type="submit" disabled={paying}>
                  {paying ? "Confirming your dates…" : `Pay ${money(quote.total)}`}
                </button>
                <p className="fine">
                  Your card is held, not charged, until your dates are confirmed. If they were taken in the meantime,
                  the hold is released.
                </p>
              </form>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
