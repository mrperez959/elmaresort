"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Month } from "./Calendar";
import { PriceBeforeTaxes } from "./Invoice";
import { Stepper } from "./Stepper";
import { POLICIES } from "@/lib/policy";
import { track } from "@/lib/track";
import type { PublicDay, PublicSettings, Quote } from "@/lib/types";
import { longDate, money } from "@/lib/format";

type Props = { settings: PublicSettings };

const count = (v: string | null, fallback: number) => {
  const n = Number(v);
  return v !== null && Number.isInteger(n) && n >= 0 ? n : fallback;
};

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function BookingWidget({ settings }: Props) {
  const params = useSearchParams();

  const [days, setDays] = useState<PublicDay[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checkIn, setCheckIn] = useState<string | null>(params.get("checkIn"));
  const [checkOut, setCheckOut] = useState<string | null>(params.get("checkOut"));
  const [adults, setAdults] = useState(Math.max(1, count(params.get("adults"), 2)));
  const [children, setChildren] = useState(count(params.get("children"), 0));
  const [infants, setInfants] = useState(count(params.get("infants"), 0));
  const [pets, setPets] = useState(count(params.get("pets"), 0));
  const [monthOffset, setMonthOffset] = useState(0);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);

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
        else {
          setQuote(body.quote);
          track("dates_selected", { n: body.quote.nights });
        }
      })
      .catch((e) => {
        if (e.name !== "AbortError") setQuoteError("The price couldn't be calculated. Try again.");
      })
      .finally(() => setQuoting(false));
    return () => ctrl.abort();
  }, [checkIn, checkOut, adults, children, infants, pets]);

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
                <i className="swatch open" /> Open, nightly rate below the date (your total with the cleaning fee shows
                when you pick dates)
              </span>
              <span>
                <i className="swatch taken" /> Booked
              </span>
            </div>
            {minStayHint && <p className="notice">{minStayHint}</p>}
            {days.length === 0 && (
              <p className="notice error" role="alert">
                No dates are open for online booking right now. Please check back soon.
              </p>
            )}
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
            <PriceBeforeTaxes quote={quote} />
            <Link
              className="pay continue"
              onClick={() => track("checkout_start", { n: quote.total })}
              href={`/checkout?${new URLSearchParams({
                checkIn: quote.checkIn,
                checkOut: quote.checkOut,
                adults: String(adults),
                children: String(children),
                infants: String(infants),
                pets: String(pets),
              })}`}
            >
              Continue to checkout
            </Link>
            <p className="fine center">
              You won&apos;t be charged yet. {POLICIES[settings.cancellationPolicy].summary.split(". ")[0]}.
            </p>
          </>
        )}
      </aside>
    </div>
  );
}
