"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Stepper } from "./Stepper";
import { SquareCard, type SquareCardHandle } from "./SquareCard";
import { FullInvoice } from "./Invoice";
import type { PublicUser, Quote } from "@/lib/types";
import { money } from "@/lib/format";

type Preview = { next: Quote; difference: number; note: string };

type Props = {
  code: string;
  quote: Quote;
  user: PublicUser;
  canChange: boolean;
  refundNow: { amount: number; reason: string } | null;
  maxGuests: number;
  maxPets: number;
  petFee: number;
  today: string;
};

export function TripManager(props: Props) {
  const { code, quote, user, canChange, refundNow } = props;
  const router = useRouter();
  const [stay, setStay] = useState({
    checkIn: quote.checkIn,
    checkOut: quote.checkOut,
    adults: quote.adults,
    children: quote.children,
    infants: quote.infants,
    pets: quote.pets,
  });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const cardRef = useRef<SquareCardHandle>(null);

  const edit = (patch: Partial<typeof stay>) => {
    setStay({ ...stay, ...patch });
    setPreview(null);
    setError(null);
    setDone(null);
  };

  const unchanged =
    stay.checkIn === quote.checkIn &&
    stay.checkOut === quote.checkOut &&
    stay.adults === quote.adults &&
    stay.children === quote.children &&
    stay.infants === quote.infants &&
    stay.pets === quote.pets;

  async function post(path: string, body: object) {
    const r = await fetch(`/api/trips/${encodeURIComponent(code)}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? "Something went wrong.");
    return data;
  }

  async function checkPrice() {
    setBusy(true);
    setError(null);
    try {
      setPreview(await post("preview", stay));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmChange() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      let card = {};
      if (preview.difference > 0) {
        if (!cardRef.current) throw new Error("The card form isn't ready yet.");
        const sourceId = await cardRef.current.tokenize(preview.difference, {
          givenName: user.firstName,
          familyName: user.lastName,
          email: user.email,
          phone: user.phone || undefined,
        });
        card = { sourceId, idempotencyKey: crypto.randomUUID() };
      }
      await post("change", { ...stay, ...card, expectedDifference: preview.difference });
      setDone(
        preview.difference > 0
          ? `Your trip was updated and ${money(preview.difference)} was charged.`
          : preview.difference < 0
            ? `Your trip was updated. ${money(-preview.difference)} is on its way back to your card.`
            : "Your trip was updated.",
      );
      setPreview(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!refundNow) return;
    const msg =
      refundNow.amount > 0
        ? `Cancel this trip? ${money(refundNow.amount)} will be refunded to your card. This can't be undone.`
        : "Cancel this trip? Under the cancellation policy nothing will be refunded. This can't be undone.";
    if (!window.confirm(msg)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await post("cancel", {});
      setDone(r.refunded > 0 ? `Your trip was cancelled. ${money(r.refunded)} is on its way back to your card.` : "Your trip was cancelled.");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!canChange) {
    return done ? <p className="notice" role="status">{done}</p> : null;
  }

  const guests = stay.adults + stay.children;

  return (
    <div className="trip-manager">
      {done && (
        <p className="notice ok-note" role="status">
          {done}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}

      <section aria-labelledby="change-heading" className="trip-box">
        <h3 id="change-heading">Change dates or guests</h3>
        <div className="date-pair">
          <label className="field">
            <span className="field-label">Check-in</span>
            <span className="field-input">
              <input type="date" min={props.today} value={stay.checkIn} onChange={(e) => edit({ checkIn: e.target.value })} />
            </span>
          </label>
          <label className="field">
            <span className="field-label">Check-out</span>
            <span className="field-input">
              <input type="date" min={stay.checkIn} value={stay.checkOut} onChange={(e) => edit({ checkOut: e.target.value })} />
            </span>
          </label>
        </div>
        <div className="guests">
          <Stepper label="Adults" value={stay.adults} min={1} max={props.maxGuests - stay.children} onChange={(n) => edit({ adults: n })} />
          <Stepper label="Children" hint="Ages 2–12" value={stay.children} min={0} max={props.maxGuests - stay.adults} onChange={(n) => edit({ children: n })} />
          <Stepper label="Infants" hint="Under 2" value={stay.infants} min={0} max={5} onChange={(n) => edit({ infants: n })} />
          {props.maxPets > 0 && (
            <Stepper label="Pets" hint={`${money(props.petFee)} per stay`} value={stay.pets} min={0} max={props.maxPets} onChange={(n) => edit({ pets: n })} />
          )}
        </div>
        <p className="fine">
          {guests} of {props.maxGuests} guests.
        </p>

        {!preview ? (
          <button type="button" className="pay" disabled={busy || unchanged} onClick={checkPrice}>
            {busy ? "Checking…" : "See the new price"}
          </button>
        ) : (
          <div className="change-preview">
            <h4>New price</h4>
            <FullInvoice quote={preview.next} />
            <p className="change-diff">
              {preview.difference > 0
                ? `You pay ${money(preview.difference)} now.`
                : preview.difference < 0
                  ? `You get ${money(-preview.difference)} back.`
                  : "No payment needed."}
              <span>{preview.note}</span>
            </p>
            {preview.difference > 0 && <SquareCard ref={cardRef} />}
            <button type="button" className="pay" disabled={busy} onClick={confirmChange}>
              {busy ? "Updating…" : preview.difference > 0 ? `Pay ${money(preview.difference)} and confirm` : "Confirm change"}
            </button>
          </div>
        )}
      </section>

      <section aria-labelledby="cancel-heading" className="trip-box">
        <h3 id="cancel-heading">Cancel trip</h3>
        {refundNow && (
          <p>
            If you cancel now, you get back <strong>{money(refundNow.amount)}</strong>. <span className="fine">({refundNow.reason}.)</span>
          </p>
        )}
        <button type="button" className="danger" disabled={busy} onClick={cancel}>
          Cancel this trip
        </button>
      </section>
    </div>
  );
}
