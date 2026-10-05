"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SquareCard, type SquareCardHandle } from "./SquareCard";
import { AuthPanel, VerifyEmail } from "./AuthPanel";
import { FullInvoice } from "./Invoice";
import { useL } from "./LangProvider";
import type { BookResult, PublicUser, Quote, StayRequest } from "@/lib/types";
import { longDate, money } from "@/lib/format";
import { guestsWord, infantsWord, petsWord } from "@/lib/i18n";
import { track } from "@/lib/track";
import { policyName, policyDeadlines, zonedInstant, graceNote, feesNote, type PolicyId } from "@/lib/policy";

type Props = { stay: StayRequest; user: PublicUser | null; policy: PolicyId; checkInHour: number };

export function Checkout({ stay, user, policy, checkInHour }: Props) {
  const { lang, l, msg } = useL();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Extract<BookResult, { state: "confirmed" }> | null>(null);
  const cardRef = useRef<SquareCardHandle>(null);

  const backHref = `/?${new URLSearchParams({
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    adults: String(stay.adults),
    children: String(stay.children),
    infants: String(stay.infants),
    pets: String(stay.pets),
    ...(stay.promo ? { promo: stay.promo } : {}),
  })}#book`;

  useEffect(() => {
    track("checkout_view");
  }, []);

  useEffect(() => {
    fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stay),
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) setQuoteError(body.error ?? "The price couldn't be calculated.");
        else {
          setQuote(body.quote);
          setPromoError(body.promoError ?? null);
          // Remember the stay, for a "your dates are still open" email if the guest doesn't finish.
          fetch("/api/checkout-intent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...stay, promo: body.quote.promoDiscount?.code, total: body.quote.total }),
          }).catch(() => undefined);
        }
      })
      .catch(() => setQuoteError("The price couldn't be calculated. Try again."));
  }, [stay]);

  const mustAgree = () =>
    agreed ? null : l("Please accept the house rules and the rental agreement first.", "Primero acepta las reglas de la casa y el contrato de alquiler.");

  async function book(sourceId: string) {
    if (!quote) return;
    setPaying(true);
    setPayError(null);
    try {
      const r = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...stay,
          // Only send the code if it was accepted for this price.
          promo: quote.promoDiscount?.code,
          agreed: true,
          sourceId,
          idempotencyKey: crypto.randomUUID(),
          expectedTotal: quote.total,
        }),
      });
      const result: BookResult = await r.json();
      if (result.state === "confirmed") {
        track("booking", { l: result.code, n: result.quote.total });
        setBooked(result);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (result.state === "price_changed") setQuote(result.quote);
      setPayError(msg(result.message));
    } catch (err) {
      setPayError(msg((err as Error).message || "Payment couldn't be completed. Try again."));
    } finally {
      setPaying(false);
    }
  }

  async function payWithCard(e: React.FormEvent) {
    e.preventDefault();
    if (!quote || !cardRef.current || !user) return;
    const stop = mustAgree();
    if (stop) return setPayError(stop);
    setPaying(true);
    setPayError(null);
    try {
      const sourceId = await cardRef.current.tokenize(quote.total, {
        givenName: user.firstName,
        familyName: user.lastName,
        email: user.email,
        phone: user.phone || undefined,
      });
      await book(sourceId);
    } catch (err) {
      setPayError(msg((err as Error).message || "Payment couldn't be completed. Try again."));
      setPaying(false);
    }
  }

  if (booked) {
    const q = booked.quote;
    return (
      <section className="status ok checkout-done" aria-live="polite">
        <h2>{l(`You're booked, ${booked.firstName}.`, `¡Reservado, ${booked.firstName}!`)}</h2>
        <p className="big-dates">
          {longDate(q.checkIn, lang)} {l("to", "al")} {longDate(q.checkOut, lang)}
        </p>
        <p>
          {l("Confirmation code", "Código de confirmación")} <strong>{booked.code}</strong>
        </p>
        <div className="receipt">
          <h3>{l("Receipt", "Recibo")}</h3>
          <FullInvoice quote={q} />
        </div>
        <p>
          {l("Your trip and this receipt are saved in", "Tu viaje y este recibo quedan guardados en")}{" "}
          <Link href="/account">{l("your account", "tu cuenta")}</Link>
          {l(
            ", where you can change or cancel it. We'll email you the check-in details on your arrival day.",
            ", donde puedes cambiarlo o cancelarlo. Te enviaremos los detalles de llegada por email el día que llegues.",
          )}
        </p>
      </section>
    );
  }

  const guests = stay.adults + stay.children;

  return (
    <div className="checkout">
      <section className="checkout-trip" aria-labelledby="trip-heading">
        <h2 id="trip-heading">{l("Your trip", "Tu viaje")}</h2>
        <dl className="trip-facts">
          <div>
            <dt>{l("Dates", "Fechas")}</dt>
            <dd>
              {longDate(stay.checkIn, lang)} {l("to", "al")} {longDate(stay.checkOut, lang)}
            </dd>
          </div>
          <div>
            <dt>{l("Guests", "Huéspedes")}</dt>
            <dd>
              {guests} {guestsWord(lang, guests)}
              {stay.infants ? `, ${stay.infants} ${infantsWord(lang, stay.infants)}` : ""}
              {stay.pets ? `, ${stay.pets} ${petsWord(lang, stay.pets)}` : ""}
            </dd>
          </div>
        </dl>
        <Link href={backHref} className="link">
          {l("Change dates or guests", "Cambiar fechas o huéspedes")}
        </Link>

        <h2 className="invoice-heading">{l("Price details", "Detalle del precio")}</h2>
        {quoteError ? (
          <p className="notice error" role="alert">
            {msg(quoteError)} <Link href={backHref}>{l("Pick different dates", "Elige otras fechas")}</Link>
          </p>
        ) : !quote ? (
          <p className="notice">{l("Calculating your total…", "Calculando tu total…")}</p>
        ) : (
          <>
            {promoError && (
              <p className="notice error">
                {l("Promo code not applied:", "Código promocional no aplicado:")} {msg(promoError)}
              </p>
            )}
            <FullInvoice quote={quote} />
          </>
        )}

        <h2 className="invoice-heading">
          {l("Cancellation policy", "Política de cancelación")}: {policyName(policy, lang)}
        </h2>
        <ul className="policy-lines">
          {policyDeadlines(policy, zonedInstant(stay.checkIn, checkInHour), "America/New_York", lang).map((x) => (
            <li key={x}>{x}</li>
          ))}
          <li>{graceNote(lang)}</li>
          <li>{feesNote(lang)}</li>
        </ul>
      </section>

      <section className="checkout-pay summary" aria-label={l("Pay", "Pagar")}>
        {!quote ? (
          <p className="notice">
            {quoteError ? l("Pick dates that are open to continue.", "Elige fechas disponibles para continuar.") : l("One moment…", "Un momento…")}
          </p>
        ) : !user ? (
          <AuthPanel
            intro={l(
              "Create an account or sign in to finish booking. Your trips and receipts are saved there.",
              "Crea una cuenta o inicia sesión para terminar la reserva. Ahí quedan guardados tus viajes y recibos.",
            )}
          />
        ) : !user.emailVerified ? (
          <VerifyEmail email={user.email} />
        ) : (
          <form className="guest-form" onSubmit={payWithCard}>
            <p className="booking-as">
              {l("Booking as", "Reservando como")}{" "}
              <strong>
                {user.firstName} {user.lastName}
              </strong>
              <br />
              {user.email}
            </p>

            <label className="agree">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>
                {l("I agree to the", "Acepto las")}{" "}
                <a href="/house-rules" target="_blank" rel="noopener">
                  {l("house rules", "reglas de la casa")}
                </a>
                {l(", the ", ", el ")}
                <a href="/rental-agreement" target="_blank" rel="noopener">
                  {l("rental agreement", "contrato de alquiler")}
                </a>{" "}
                {l("and the cancellation policy.", "y la política de cancelación.")}
              </span>
            </label>

            <SquareCard
              ref={cardRef}
              walletAmountCents={quote.total}
              beforeWallet={mustAgree}
              onWalletToken={(token) => book(token)}
            />
            {payError && (
              <p className="notice error" role="alert">
                {payError}
              </p>
            )}
            <button className="pay" type="submit" disabled={paying}>
              {paying ? l("Confirming your dates…", "Confirmando tus fechas…") : `${l("Pay", "Pagar")} ${money(quote.total)}`}
            </button>
            <p className="fine">
              {l(
                "Your card is held, not charged, until your dates are confirmed. If they were taken in the meantime, the hold is released.",
                "Tu tarjeta queda retenida, no cobrada, hasta confirmar tus fechas. Si alguien las tomó mientras tanto, la retención se libera.",
              )}
            </p>
          </form>
        )}
      </section>
    </div>
  );
}
