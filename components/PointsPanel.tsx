"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useL } from "./LangProvider";
import { longDate, money } from "@/lib/format";
import type { HistoryRow, PostView } from "@/lib/points";

type Props = {
  available: number;
  nextExpiry: { date: string; points: number } | null;
  canEarn: boolean;
  posts: PostView[];
  history: HistoryRow[];
  rules: { centsPerPoint: number; pointsPerLike: number; pointsPerComment: number; transferMin: number };
};

async function post(path: string, body: object) {
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
  return data;
}

export function PointsPanel({ available, nextExpiry, canEarn, posts, history, rules }: Props) {
  const { lang, l, msg } = useL();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [disclosed, setDisclosed] = useState(false);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<"post" | "transfer" | null>(null);
  const [note, setNote] = useState<{ where: "post" | "transfer"; ok: boolean; text: string } | null>(null);

  async function sendPost(e: React.FormEvent) {
    e.preventDefault();
    setBusy("post");
    setNote(null);
    try {
      await post("/api/points/submit", { url, disclosed });
      setUrl("");
      setDisclosed(false);
      setNote({ where: "post", ok: true, text: l("Sent! We'll review it and add your points.", "¡Enviada! La revisaremos y sumaremos tus puntos.") });
      router.refresh();
    } catch (err) {
      setNote({ where: "post", ok: false, text: msg((err as Error).message) });
    } finally {
      setBusy(null);
    }
  }

  async function sendTransfer(e: React.FormEvent) {
    e.preventDefault();
    const n = Math.floor(Number(amount));
    if (!window.confirm(l(`Send ${n} points to ${to}? This can't be undone.`, `¿Enviar ${n} puntos a ${to}? No se puede deshacer.`))) return;
    setBusy("transfer");
    setNote(null);
    try {
      const r = await post("/api/points/transfer", { email: to, points: n });
      setTo("");
      setAmount("");
      setNote({ where: "transfer", ok: true, text: l(`Sent ${n} points to ${r.recipientName}.`, `Enviaste ${n} puntos a ${r.recipientName}.`) });
      router.refresh();
    } catch (err) {
      setNote({ where: "transfer", ok: false, text: msg((err as Error).message) });
    } finally {
      setBusy(null);
    }
  }

  const status = (s: string) =>
    s === "approved" ? l("Approved", "Aprobada") : s === "rejected" ? l("Not approved", "No aprobada") : l("In review", "En revisión");

  const kind = (k: string) =>
    ({
      earn: l("Instagram post", "Publicación en Instagram"),
      transfer_in: l("Received", "Recibidos"),
      transfer_out: l("Sent", "Enviados"),
      redeem: l("Used on a booking", "Usados en una reserva"),
      restore: l("Returned", "Devueltos"),
      adjust: l("Adjustment", "Ajuste"),
    })[k] ?? k;

  return (
    <section className="points" aria-labelledby="points-heading">
      <div className="points-head">
        <h3 id="points-heading">Elma Points</h3>
        <Link href={lang === "es" ? "/es/points" : "/points"} className="link">
          {l("How it works", "Cómo funciona")}
        </Link>
      </div>

      <div className="points-balance">
        <strong>{available.toLocaleString()}</strong>
        <span>
          {l("points", "puntos")} = {money(available * rules.centsPerPoint)} {l("off your next booking", "de descuento en tu próxima reserva")}
        </span>
        {nextExpiry && (
          <small>
            {l(
              `${nextExpiry.points.toLocaleString()} expire on ${longDate(nextExpiry.date, lang)}`,
              `${nextExpiry.points.toLocaleString()} vencen el ${longDate(nextExpiry.date, lang)}`,
            )}
          </small>
        )}
      </div>

      <div className="points-grid">
        <form className="guest-form" onSubmit={sendPost}>
          <h4>{l("Earn points", "Gana puntos")}</h4>
          {canEarn ? (
            <>
              <p className="fine">
                {l(
                  `Post about your stay on Instagram tagging @elmaresort (or as a collaboration). You get ${rules.pointsPerLike} point per like and ${rules.pointsPerComment} per comment.`,
                  `Publica sobre tu estadía en Instagram etiquetando a @elmaresort (o como colaboración). Ganas ${rules.pointsPerLike} punto por like y ${rules.pointsPerComment} por comentario.`,
                )}
              </p>
              <label>
                {l("Link to your post", "Enlace de tu publicación")}
                <input
                  type="url"
                  inputMode="url"
                  placeholder="https://www.instagram.com/p/…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </label>
              <label className="agree">
                <input type="checkbox" checked={disclosed} onChange={(e) => setDisclosed(e.target.checked)} required />
                <span>
                  {l(
                    "My post tags @elmaresort and says I get points for it (for example #ad or “I earn Elma Points”).",
                    "Mi publicación etiqueta a @elmaresort e indica que recibo puntos (por ejemplo #ad o “gano Elma Points”).",
                  )}
                </span>
              </label>
              {note?.where === "post" && <p className={`notice ${note.ok ? "" : "error"}`}>{note.text}</p>}
              <button className="pay" type="submit" disabled={busy !== null}>
                {busy === "post" ? l("Sending…", "Enviando…") : l("Send for review", "Enviar a revisión")}
              </button>
            </>
          ) : (
            <p className="fine">
              {l(
                "You can earn points from Instagram once your stay at Elma Resort has started. Points you receive from friends can be used anytime.",
                "Puedes ganar puntos con Instagram cuando haya empezado tu estadía en Elma Resort. Los puntos que te envíen tus amigos se pueden usar cuando quieras.",
              )}
            </p>
          )}
        </form>

        <form className="guest-form" onSubmit={sendTransfer}>
          <h4>{l("Send points", "Enviar puntos")}</h4>
          <p className="fine">
            {l(
              `To another Elma Resort account with a confirmed email. Minimum ${rules.transferMin} points.`,
              `A otra cuenta de Elma Resort con email confirmado. Mínimo ${rules.transferMin} puntos.`,
            )}
          </p>
          <label>
            {l("Their email", "Su email")}
            <input type="email" value={to} onChange={(e) => setTo(e.target.value)} required />
          </label>
          <label>
            {l("Points", "Puntos")}
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              required
            />
          </label>
          {note?.where === "transfer" && <p className={`notice ${note.ok ? "" : "error"}`}>{note.text}</p>}
          <button className="pay secondary" type="submit" disabled={busy !== null || available < rules.transferMin}>
            {busy === "transfer" ? l("Sending…", "Enviando…") : l("Send points", "Enviar puntos")}
          </button>
        </form>
      </div>

      {posts.length > 0 && (
        <>
          <h4>{l("Your posts", "Tus publicaciones")}</h4>
          <ul className="points-list">
            {posts.map((p) => (
              <li key={p.id}>
                <a href={p.url} target="_blank" rel="noopener noreferrer">
                  {p.url.replace("https://www.instagram.com/", "instagram.com/")}
                </a>
                <span className={`pill ${p.status === "approved" ? "ok" : p.status === "rejected" ? "off" : "soon"}`}>
                  {status(p.status)}
                  {p.status === "approved" && p.points !== null ? ` · +${p.points}` : ""}
                </span>
                {p.status === "rejected" && p.note && <small>{p.note}</small>}
              </li>
            ))}
          </ul>
        </>
      )}

      {history.length > 0 && (
        <>
          <h4>{l("History", "Historial")}</h4>
          <ul className="points-list">
            {history.map((h, i) => (
              <li key={i}>
                <span>
                  {longDate(h.date, lang)} · {kind(h.kind)}
                  {h.kind === "transfer_in" || h.kind === "transfer_out" ? ` (${h.note})` : ""}
                </span>
                <strong className={h.delta > 0 ? "plus" : "minus"}>
                  {h.delta > 0 ? "+" : ""}
                  {h.delta.toLocaleString()}
                </strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
