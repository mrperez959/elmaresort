"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Stepper } from "./Stepper";
import { SquareCard, type SquareCardHandle } from "./SquareCard";
import { FullInvoice } from "./Invoice";
import type { PublicUser, Quote } from "@/lib/types";
import { money } from "@/lib/format";
import { useL } from "./LangProvider";

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
  const { l, msg } = useL();
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
    if (!r.ok) throw new Error(msg(data.error ?? "Something went wrong."));
    return data;
  }

  async function checkPrice() {
    setBusy(true);
    setError(null);
    try {
      const p = await post("preview", stay);
      setPreview({ ...p, note: msg(p.note) });
    } catch (err) {
      setError(msg((err as Error).message));
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
        if (!cardRef.current) throw new Error(msg("The payment form isn't ready yet."));
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
          ? l(`Your trip was updated and ${money(preview.difference)} was charged.`, `Tu viaje se actualizó y se cobraron ${money(preview.difference)}.`)
          : preview.difference < 0
            ? l(
                `Your trip was updated. ${money(-preview.difference)} is on its way back to your card.`,
                `Tu viaje se actualizó. ${money(-preview.difference)} vuelven a tu tarjeta.`,
              )
            : l("Your trip was updated.", "Tu viaje se actualizó."),
      );
      setPreview(null);
      router.refresh();
    } catch (err) {
      setError(msg((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!refundNow) return;
    const question =
      refundNow.amount > 0
        ? l(
            `Cancel this trip? ${money(refundNow.amount)} will be refunded to your card. This can't be undone.`,
            `¿Cancelar este viaje? Se devolverán ${money(refundNow.amount)} a tu tarjeta. No se puede deshacer.`,
          )
        : l(
            "Cancel this trip? Under the cancellation policy nothing will be refunded. This can't be undone.",
            "¿Cancelar este viaje? Según la política de cancelación no se devolverá nada. No se puede deshacer.",
          );
    if (!window.confirm(question)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await post("cancel", {});
      setDone(
        r.refunded > 0
          ? l(`Your trip was cancelled. ${money(r.refunded)} is on its way back to your card.`, `Tu viaje se canceló. ${money(r.refunded)} vuelven a tu tarjeta.`)
          : l("Your trip was cancelled.", "Tu viaje se canceló."),
      );
      router.refresh();
    } catch (err) {
      setError(msg((err as Error).message));
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
        <h3 id="change-heading">{l("Change dates or guests", "Cambiar fechas o huéspedes")}</h3>
        <div className="date-pair">
          <label className="field">
            <span className="field-label">{l("Check-in", "Llegada")}</span>
            <span className="field-input">
              <input type="date" min={props.today} value={stay.checkIn} onChange={(e) => edit({ checkIn: e.target.value })} />
            </span>
          </label>
          <label className="field">
            <span className="field-label">{l("Check-out", "Salida")}</span>
            <span className="field-input">
              <input type="date" min={stay.checkIn} value={stay.checkOut} onChange={(e) => edit({ checkOut: e.target.value })} />
            </span>
          </label>
        </div>
        <div className="guests">
          <Stepper label={l("Adults", "Adultos")} value={stay.adults} min={1} max={props.maxGuests - stay.children} onChange={(n) => edit({ adults: n })} />
          <Stepper label={l("Children", "Niños")} hint={l("Ages 2–12", "De 2 a 12 años")} value={stay.children} min={0} max={props.maxGuests - stay.adults} onChange={(n) => edit({ children: n })} />
          <Stepper label={l("Infants", "Bebés")} hint={l("Under 2", "Menores de 2")} value={stay.infants} min={0} max={5} onChange={(n) => edit({ infants: n })} />
          {props.maxPets > 0 && (
            <Stepper label={l("Pets", "Mascotas")} hint={l(`${money(props.petFee)} per stay`, `${money(props.petFee)} por estadía`)} value={stay.pets} min={0} max={props.maxPets} onChange={(n) => edit({ pets: n })} />
          )}
        </div>
        <p className="fine">
          {l(`${guests} of ${props.maxGuests} guests.`, `${guests} de ${props.maxGuests} huéspedes.`)}
        </p>

        {!preview ? (
          <button type="button" className="pay" disabled={busy || unchanged} onClick={checkPrice}>
            {busy ? l("Checking…", "Revisando…") : l("See the new price", "Ver el nuevo precio")}
          </button>
        ) : (
          <div className="change-preview">
            <h4>{l("New price", "Nuevo precio")}</h4>
            <FullInvoice quote={preview.next} />
            <p className="change-diff">
              {preview.difference > 0
                ? l(`You pay ${money(preview.difference)} now.`, `Pagas ${money(preview.difference)} ahora.`)
                : preview.difference < 0
                  ? l(`You get ${money(-preview.difference)} back.`, `Te devolvemos ${money(-preview.difference)}.`)
                  : l("No payment needed.", "No hace falta pagar.")}
              <span>{preview.note}</span>
            </p>
            {preview.difference > 0 && <SquareCard ref={cardRef} />}
            <button type="button" className="pay" disabled={busy} onClick={confirmChange}>
              {busy
                ? l("Updating…", "Actualizando…")
                : preview.difference > 0
                  ? l(`Pay ${money(preview.difference)} and confirm`, `Pagar ${money(preview.difference)} y confirmar`)
                  : l("Confirm change", "Confirmar cambio")}
            </button>
          </div>
        )}
      </section>

      <section aria-labelledby="cancel-heading" className="trip-box">
        <h3 id="cancel-heading">{l("Cancel trip", "Cancelar viaje")}</h3>
        {refundNow && (
          <p>
            {l("If you cancel now, you get back", "Si cancelas ahora, te devolvemos")} <strong>{money(refundNow.amount)}</strong>.{" "}
            <span className="fine">({msg(refundNow.reason)}.)</span>
          </p>
        )}
        <button type="button" className="danger" disabled={busy} onClick={cancel}>
          {l("Cancel this trip", "Cancelar este viaje")}
        </button>
      </section>
    </div>
  );
}
