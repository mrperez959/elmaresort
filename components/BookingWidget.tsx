"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Month } from "./Calendar";
import { PriceBeforeTaxes } from "./Invoice";
import { Stepper } from "./Stepper";
import { policySummary } from "@/lib/policy";
import { useL } from "./LangProvider";
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
  const { lang, l, msg } = useL();
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

  const [promo, setPromo] = useState<string>((params.get("promo") ?? "").toUpperCase());
  const [promoInput, setPromoInput] = useState<string>((params.get("promo") ?? "").toUpperCase());
  const [promoOpen, setPromoOpen] = useState(Boolean(params.get("promo")));
  const [promoError, setPromoError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);

  const loadDays = useCallback(() => {
    fetch("/api/availability")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(msg(body.error ?? "Availability couldn't be loaded."));
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
      body: JSON.stringify({ checkIn, checkOut, adults, children, infants, pets, promo: promo || undefined }),
      signal: ctrl.signal,
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) setQuoteError(msg(body.error ?? "The price couldn't be calculated."));
        else {
          setQuote(body.quote);
          setPromoError(body.promoError ? msg(body.promoError) : null);
          track("dates_selected", { n: body.quote.nights });
        }
      })
      .catch((e) => {
        if (e.name !== "AbortError") setQuoteError(msg("The price couldn't be calculated. Try again."));
      })
      .finally(() => setQuoting(false));
    return () => ctrl.abort();
  }, [checkIn, checkOut, adults, children, infants, pets, promo]);

  const base = new Date(`${today}T00:00:00Z`);
  const months = [0, 1].map((i) => {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + monthOffset + i, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  });
  const lastShown = new Date(Date.UTC(months[1].year, months[1].month + 1, 0)).toISOString().slice(0, 10);

  const minStayHint =
    checkIn && !checkOut && (dayMap.get(checkIn)?.minStay ?? 1) > 1
      ? l(
          `Stays from ${longDate(checkIn, lang)} need at least ${dayMap.get(checkIn)!.minStay} nights.`,
          `Las estadías desde el ${longDate(checkIn, lang)} requieren al menos ${dayMap.get(checkIn)!.minStay} noches.`,
        )
      : null;

  const perks: string[] = [];
  if (settings.directDiscountEnabled && settings.directDiscountPercent > 0) {
    perks.push(l(`${settings.directDiscountPercent}% off for booking here`, `${settings.directDiscountPercent}% menos por reservar aquí`));
  }
  if (settings.weeklyDiscountPercent > 0)
    perks.push(l(`${settings.weeklyDiscountPercent}% off ${settings.weeklyMinNights}+ nights`, `${settings.weeklyDiscountPercent}% menos en ${settings.weeklyMinNights}+ noches`));
  if (settings.monthlyDiscountPercent > 0)
    perks.push(l(`${settings.monthlyDiscountPercent}% off ${settings.monthlyMinNights}+ nights`, `${settings.monthlyDiscountPercent}% menos en ${settings.monthlyMinNights}+ noches`));

  return (
    <div className="booking">
      <section className="calendar-panel" aria-labelledby="dates-heading">
        <div className="calendar-head">
          <h2 id="dates-heading">
            {!checkIn
              ? l("Pick your check-in day", "Elige el día de llegada")
              : !checkOut
                ? l("Now pick your check-out day", "Ahora elige el día de salida")
                : l("Your dates", "Tus fechas")}
          </h2>
          <div className="calendar-nav">
            <button type="button" aria-label={l("Previous months", "Meses anteriores")} disabled={monthOffset === 0} onClick={() => setMonthOffset((m) => Math.max(0, m - 2))}>
              ‹
            </button>
            <button type="button" aria-label={l("Next months", "Meses siguientes")} disabled={lastShown >= lastDate} onClick={() => setMonthOffset((m) => m + 2)}>
              ›
            </button>
          </div>
        </div>

        {loadError ? (
          <p className="notice error" role="alert">
            {loadError} {l("Refresh the page to try again.", "Recarga la página para intentarlo de nuevo.")}
          </p>
        ) : !days ? (
          <p className="notice">{l("Loading availability…", "Cargando disponibilidad…")}</p>
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
                <i className="swatch open" />{" "}
                {l(
                  "Open, nightly rate below the date (your total with the cleaning fee shows when you pick dates)",
                  "Disponible, precio por noche debajo de la fecha (el total con limpieza aparece al elegir fechas)",
                )}
              </span>
              <span>
                <i className="swatch taken" /> {l("Booked", "Reservado")}
              </span>
            </div>
            {minStayHint && <p className="notice">{minStayHint}</p>}
            {days.length === 0 && (
              <p className="notice error" role="alert">
                {l("No dates are open for online booking right now. Please check back soon.", "Ahora no hay fechas abiertas para reservar en línea. Vuelve pronto.")}
              </p>
            )}
          </>
        )}
      </section>

      <aside className="summary" aria-label={l("Your booking", "Tu reserva")}>
        {perks.length > 0 && (
          <ul className="perks">
            {perks.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}

        <dl className="dates">
          <div>
            <dt>{l("Check-in", "Llegada")}</dt>
            <dd>{checkIn ? longDate(checkIn, lang) : l("Add date", "Agregar fecha")}</dd>
          </div>
          <div>
            <dt>{l("Check-out", "Salida")}</dt>
            <dd>{checkOut ? longDate(checkOut, lang) : l("Add date", "Agregar fecha")}</dd>
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
            {l("Clear dates", "Borrar fechas")}
          </button>
        )}

        <div className="guests">
          <Stepper label={l("Adults", "Adultos")} value={adults} min={1} max={settings.maxGuests - children} onChange={setAdults} />
          <Stepper label={l("Children", "Niños")} hint={l("Ages 2–12", "De 2 a 12 años")} value={children} min={0} max={Math.max(0, settings.maxGuests - adults)} onChange={setChildren} />
          <Stepper label={l("Infants", "Bebés")} hint={l("Under 2", "Menores de 2")} value={infants} min={0} max={5} onChange={setInfants} />
          {settings.maxPets > 0 && (
            <Stepper
              label={l("Pets", "Mascotas")}
              hint={l(`${money(settings.petFee)} per stay`, `${money(settings.petFee)} por estadía`)}
              value={pets}
              min={0}
              max={settings.maxPets}
              onChange={setPets}
            />
          )}
        </div>
        <p className="fine">
          {l(`Up to ${settings.maxGuests} guests, not counting infants.`, `Hasta ${settings.maxGuests} huéspedes, sin contar bebés.`)}
        </p>

        <div className="promo">
          {promo && quote?.promoDiscount ? (
            <p className="promo-applied">
              <span>
                <strong>{quote.promoDiscount.code}</strong>{" "}
                {l(`applied: ${quote.promoDiscount.percent}% off`, `aplicado: ${quote.promoDiscount.percent}% de descuento`)}
              </span>
              <button
                type="button"
                className="link"
                onClick={() => {
                  setPromo("");
                  setPromoInput("");
                  setPromoError(null);
                }}
              >
                {l("Remove", "Quitar")}
              </button>
            </p>
          ) : !promoOpen ? (
            <button type="button" className="link" onClick={() => setPromoOpen(true)}>
              {l("Have a promo code?", "¿Tienes un código promocional?")}
            </button>
          ) : (
            <form
              className="promo-form"
              onSubmit={(e) => {
                e.preventDefault();
                setPromoError(null);
                setPromo(promoInput.trim().toUpperCase());
                if (!checkIn || !checkOut) setPromoError(l("Pick your dates and the code will be applied.", "Elige tus fechas y el código se aplicará."));
              }}
            >
              <label className="field">
                <span className="field-label">{l("Promo code", "Código promocional")}</span>
                <span className="field-input">
                  <input
                    value={promoInput}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={24}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  />
                </span>
              </label>
              <button type="submit" className="promo-apply" disabled={!promoInput.trim()}>
                {l("Apply", "Aplicar")}
              </button>
            </form>
          )}
          {promoError && (
            <p className="notice error" role="alert">
              {promoError}
            </p>
          )}
        </div>

        {!settings.bookingOpen && <p className="notice">{l("Online booking opens soon.", "La reserva en línea abre pronto.")}</p>}
        {quoting && <p className="notice">{l("Calculating your total…", "Calculando tu total…")}</p>}
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
                ...(quote.promoDiscount ? { promo: quote.promoDiscount.code } : {}),
              })}`}
            >
              {l("Continue to checkout", "Continuar al pago")}
            </Link>
            <p className="fine center">
              {l("You won't be charged yet.", "Todavía no se te cobra nada.")}{" "}
              {policySummary(settings.cancellationPolicy, lang).split(". ")[0]}.
            </p>
          </>
        )}
      </aside>
    </div>
  );
}
