"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SquareCard, type SquareCardHandle } from "./SquareCard";
import { AuthPanel, VerifyEmail } from "./AuthPanel";
import { FullInvoice } from "./Invoice";
import type { BookResult, PublicUser, Quote, StayRequest } from "@/lib/types";
import { longDate, money } from "@/lib/format";
import { track } from "@/lib/track";
import { POLICIES, policyDeadlines, zonedInstant, GRACE_NOTE, FEES_NOTE, type PolicyId } from "@/lib/policy";

type Props = { stay: StayRequest; user: PublicUser | null; policy: PolicyId; checkInHour: number };

export function Checkout({ stay, user, policy, checkInHour }: Props) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
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
        else setQuote(body.quote);
      })
      .catch(() => setQuoteError("The price couldn't be calculated. Try again."));
  }, [stay]);

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
          ...stay,
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
      setPayError(result.message);
    } catch (err) {
      setPayError((err as Error).message || "Payment couldn't be completed. Try again.");
    } finally {
      setPaying(false);
    }
  }

  if (booked) {
    const q = booked.quote;
    return (
      <section className="status ok checkout-done" aria-live="polite">
        <h2>You&apos;re booked, {booked.firstName}.</h2>
        <p className="big-dates">
          {longDate(q.checkIn)} to {longDate(q.checkOut)}
        </p>
        <p>
          Confirmation code <strong>{booked.code}</strong>
        </p>
        <div className="receipt">
          <h3>Receipt</h3>
          <FullInvoice quote={q} />
        </div>
        <p>
          Your trip and this receipt are saved in <Link href="/account">your account</Link>, where you can change or
          cancel it. Check-in details will be sent to {user?.email} before your arrival.
        </p>
      </section>
    );
  }

  const guests = stay.adults + stay.children;

  return (
    <div className="checkout">
      <section className="checkout-trip" aria-labelledby="trip-heading">
        <h2 id="trip-heading">Your trip</h2>
        <dl className="trip-facts">
          <div>
            <dt>Dates</dt>
            <dd>
              {longDate(stay.checkIn)} to {longDate(stay.checkOut)}
            </dd>
          </div>
          <div>
            <dt>Guests</dt>
            <dd>
              {guests} {guests === 1 ? "guest" : "guests"}
              {stay.infants ? `, ${stay.infants} ${stay.infants === 1 ? "infant" : "infants"}` : ""}
              {stay.pets ? `, ${stay.pets} ${stay.pets === 1 ? "pet" : "pets"}` : ""}
            </dd>
          </div>
        </dl>
        <Link href={backHref} className="link">
          Change dates or guests
        </Link>

        <h2 className="invoice-heading">Price details</h2>
        {quoteError ? (
          <p className="notice error" role="alert">
            {quoteError} <Link href={backHref}>Pick different dates</Link>
          </p>
        ) : !quote ? (
          <p className="notice">Calculating your total…</p>
        ) : (
          <FullInvoice quote={quote} />
        )}

        <h2 className="invoice-heading">Cancellation policy: {POLICIES[policy].name}</h2>
        <ul className="policy-lines">
          {policyDeadlines(policy, zonedInstant(stay.checkIn, checkInHour)).map((l) => (
            <li key={l}>{l}</li>
          ))}
          <li>{GRACE_NOTE}</li>
          <li>{FEES_NOTE}</li>
        </ul>
      </section>

      <section className="checkout-pay summary" aria-label="Pay">
        {!quote ? (
          <p className="notice">{quoteError ? "Pick dates that are open to continue." : "One moment…"}</p>
        ) : !user ? (
          <AuthPanel intro="Create an account or sign in to finish booking. Your trips and receipts are saved there." />
        ) : !user.emailVerified ? (
          <VerifyEmail email={user.email} />
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
              By selecting Pay, you agree to the cancellation policy. Your card is held, not charged, until your dates
              are confirmed. If they were taken in the meantime, the hold is released.
            </p>
          </form>
        )}
      </section>
    </div>
  );
}
