"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Month } from "./Calendar";
import { SquareCard, type SquareCardHandle } from "./SquareCard";
import type { BookResult, GuestDetails, PublicDay, Quote } from "@/lib/types";
import { longDate, money } from "@/lib/format";

type Props = { maxGuests: number };

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="stepper">
      <div>
        <div className="stepper-label">{label}</div>
        {hint && <div className="stepper-hint">{hint}</div>}
      </div>
      <div className="stepper-controls">
        <button
          type="button"
          aria-label={`Fewer ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          −
        </button>
        <span aria-live="polite">{value}</span>
        <button
          type="button"
          aria-label={`More ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function BookingWidget({ maxGuests }: Props) {
  const params = useSearchParams();

  const [days, setDays] = useState<PublicDay[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checkIn, setCheckIn] = useState<string | null>(params.get("checkIn"));
  const [checkOut, setCheckOut] = useState<string | null>(params.get("checkOut"));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);

  const [guest, setGuest] = useState<GuestDetails>({ firstName: "", lastName: "", email: "", phone: "" });
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Extract<BookResult, { state: "confirmed" }> | null>(null);
  const cardRef = useRef<SquareCardHandle>(null);

  useEffect(() => {
    fetch("/api/availability")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "Availability couldn't be loaded.");
        setDays(body.days);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

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
      for (let d = from; d < to; d = addDays(d, 1)) {
        if (!dayMap.get(d)?.available) return false;
      }
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

  function clearDates() {
    setCheckIn(null);
    setCheckOut(null);
  }

  // Price the stay whenever dates or guests change.
  useEffect(() => {
    setQuote(null);
    setQuoteError(null);
    if (!checkIn || !checkOut) return;
    const ctrl = new AbortController();
    setQuoting(true);
    fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkIn, checkOut, adults, children, infants }),
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
  }, [checkIn, checkOut, adults, children, infants]);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!quote || !cardRef.current) return;
    setPaying(true);
    setPayError(null);
    try {
      const sourceId = await cardRef.current.tokenize(quote.total, {
        givenName: guest.firstName,
        familyName: guest.lastName,
        email: guest.email,
        phone: guest.phone || undefined,
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
          guest,
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
      if (result.state === "released") {
        // Reload availability so the taken nights show as booked.
        fetch("/api/availability")
          .then((res) => res.json())
          .then((b) => b.days && setDays(b.days))
          .catch(() => undefined);
      }
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
        <p>Keep this code for your records. Check-in details will be sent to {guest.email} before your arrival.</p>
      </section>
    );
  }

  // Months to show: the current page of two.
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

  const childrenMax = Math.max(0, maxGuests - adults);

  return (
    <div className="booking">
      <section className="calendar-panel" aria-labelledby="dates-heading">
        <div className="calendar-head">
          <h2 id="dates-heading">
            {!checkIn ? "Pick your check-in day" : !checkOut ? "Now pick your check-out day" : "Your dates"}
          </h2>
          <div className="calendar-nav">
            <button
              type="button"
              aria-label="Previous months"
              disabled={monthOffset === 0}
              onClick={() => setMonthOffset((m) => Math.max(0, m - 2))}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next months"
              disabled={lastShown >= lastDate}
              onClick={() => setMonthOffset((m) => m + 2)}
            >
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
          <button type="button" className="link" onClick={clearDates}>
            Clear dates
          </button>
        )}

        <div className="guests">
          <Stepper label="Adults" value={adults} min={1} max={maxGuests - children} onChange={setAdults} />
          <Stepper
            label="Children"
            hint="Ages 2–12"
            value={children}
            min={0}
            max={childrenMax}
            onChange={setChildren}
          />
          <Stepper label="Infants" hint="Under 2" value={infants} min={0} max={5} onChange={setInfants} />
        </div>

        {quoting && <p className="notice">Calculating your total…</p>}
        {quoteError && (
          <p className="notice error" role="alert">
            {quoteError}
          </p>
        )}

        {quote && (
          <>
            <table className="breakdown">
              <tbody>
                <tr>
                  <th scope="row">
                    {quote.nights} {quote.nights === 1 ? "night" : "nights"}
                  </th>
                  <td>{money(quote.accommodation)}</td>
                </tr>
                {quote.cleaningFee > 0 && (
                  <tr>
                    <th scope="row">Cleaning fee</th>
                    <td>{money(quote.cleaningFee)}</td>
                  </tr>
                )}
                {quote.tax > 0 && (
                  <tr>
                    <th scope="row">Taxes</th>
                    <td>{money(quote.tax)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td>{money(quote.total)}</td>
                </tr>
              </tfoot>
            </table>

            <form className="guest-form" onSubmit={pay}>
              <div className="row">
                <label>
                  First name
                  <input
                    required
                    autoComplete="given-name"
                    value={guest.firstName}
                    onChange={(e) => setGuest({ ...guest, firstName: e.target.value })}
                  />
                </label>
                <label>
                  Last name
                  <input
                    required
                    autoComplete="family-name"
                    value={guest.lastName}
                    onChange={(e) => setGuest({ ...guest, lastName: e.target.value })}
                  />
                </label>
              </div>
              <label>
                Email
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={guest.email}
                  onChange={(e) => setGuest({ ...guest, email: e.target.value })}
                />
              </label>
              <label>
                Phone
                <input
                  type="tel"
                  autoComplete="tel"
                  value={guest.phone}
                  onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
                />
              </label>
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
                Your card is held, not charged, until your dates are confirmed. If they were taken in the
                meantime, the hold is released.
              </p>
            </form>
          </>
        )}
      </aside>
    </div>
  );
}
