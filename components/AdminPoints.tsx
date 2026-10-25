"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminPost } from "@/lib/points";
import type { Loyalty } from "@/lib/types";
import { pointsForPost } from "@/lib/points-math";

type Props = {
  pending: AdminPost[];
  reviewed: AdminPost[];
  balances: Array<{ name: string; email: string; available: number }>;
  loyalty: Loyalty;
};

async function send(body: object) {
  const r = await fetch("/api/admin/points", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
  return data;
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function Review({ post, loyalty, onDone }: { post: AdminPost; loyalty: Loyalty; onDone: (msg: string) => void }) {
  const [likes, setLikes] = useState("");
  const [comments, setComments] = useState("");
  const [override, setOverride] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auto = likes !== "" && comments !== "" ? pointsForPost(Number(likes), Number(comments), loyalty) : null;

  async function act(body: object, msg: string) {
    setBusy(true);
    setError(null);
    try {
      await send(body);
      onDone(msg);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="post-review">
      <div>
        <strong>{post.guest}</strong> <span className="fine">{post.email} · sent {day(post.createdAt)}</span>
        <br />
        <a href={post.url} target="_blank" rel="noopener noreferrer" className="link">
          Open post on Instagram ↗
        </a>
      </div>
      <div className="post-review-fields">
        <label className="field">
          <span className="field-label">Likes</span>
          <span className="field-input small">
            <input inputMode="numeric" value={likes} onChange={(e) => setLikes(e.target.value.replace(/\D/g, ""))} />
          </span>
        </label>
        <label className="field">
          <span className="field-label">Comments</span>
          <span className="field-input small">
            <input inputMode="numeric" value={comments} onChange={(e) => setComments(e.target.value.replace(/\D/g, ""))} />
          </span>
        </label>
        <label className="field">
          <span className="field-label">Points (optional)</span>
          <span className="field-input small">
            <input
              inputMode="numeric"
              value={override}
              placeholder={auto === null ? "auto" : String(auto)}
              onChange={(e) => setOverride(e.target.value.replace(/\D/g, ""))}
            />
          </span>
        </label>
      </div>
      <p className="fine">
        {auto === null
          ? `${loyalty.pointsPerLike} per like, ${loyalty.pointsPerComment} per comment, max ${loyalty.maxPointsPerPost}.`
          : `Will add ${override !== "" ? override : auto} points.`}
      </p>
      <div className="admin-actions">
        <button
          className="pay"
          type="button"
          disabled={busy || likes === "" || comments === ""}
          onClick={() =>
            act(
              { action: "approve", id: post.id, likes, comments, points: override },
              `Approved ${post.guest}'s post: +${override !== "" ? override : auto} points.`,
            )
          }
        >
          Approve
        </button>
        <span className="field-input">
          <input value={note} placeholder="Reason, shown to the guest" onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </span>
        <button
          className="link"
          type="button"
          disabled={busy}
          onClick={() => {
            if (!note.trim()) return setError("Write a short reason so the guest knows what to fix.");
            act({ action: "reject", id: post.id, note }, `Rejected ${post.guest}'s post.`);
          }}
        >
          Reject
        </button>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

const RULES: Array<{ key: keyof Loyalty; label: string; hint?: string; affix?: string }> = [
  { key: "pointsPerLike", label: "Points per like" },
  { key: "pointsPerComment", label: "Points per comment" },
  { key: "maxPointsPerPost", label: "Max points per post" },
  { key: "centsPerPoint", label: "Value of a point", affix: "¢", hint: "10¢ means 100 points = $10." },
  { key: "maxDiscountPercent", label: "Max discount per booking", affix: "%", hint: "Of the nights, after other discounts." },
  { key: "expiryMonths", label: "Points expire after", affix: "months" },
  { key: "transferMin", label: "Minimum transfer", affix: "pts" },
  { key: "transferMonthlyCap", label: "Transfer cap every 30 days", affix: "pts", hint: "0 turns transfers off." },
];

export function AdminPoints({ pending, reviewed, balances, loyalty }: Props) {
  const router = useRouter();
  const [flash, setFlash] = useState<string | null>(null);
  const [rules, setRules] = useState(() =>
    Object.fromEntries(RULES.map((r) => [r.key, String(loyalty[r.key])])) as Record<string, string>,
  );
  const [enabled, setEnabled] = useState(loyalty.enabled);
  const [adj, setAdj] = useState({ email: "", points: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ where: string; text: string } | null>(null);

  const done = (msg: string) => {
    setFlash(msg);
    router.refresh();
  };

  async function saveRules(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await send({
        action: "rules",
        loyalty: { enabled, ...Object.fromEntries(Object.entries(rules).map(([k, v]) => [k, Number(v)])) },
      });
      done("Rules saved.");
    } catch (err) {
      setError({ where: "rules", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function saveAdjust(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await send({ action: "adjust", ...adj });
      done(`Adjusted ${adj.email} by ${adj.points} points.`);
      setAdj({ email: "", points: "", note: "" });
    } catch (err) {
      setError({ where: "adjust", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="promos">
      {flash && (
        <p className="notice" role="status">
          {flash}
        </p>
      )}

      <h2 className="admin-section first">To review ({pending.length})</h2>
      {pending.length ? (
        <ul className="post-reviews">
          {pending.map((p) => (
            <Review key={p.id} post={p} loyalty={loyalty} onDone={done} />
          ))}
        </ul>
      ) : (
        <p className="fine">No posts waiting. You get an email when a guest sends one.</p>
      )}

      <h2 className="admin-section">Balances</h2>
      {balances.length ? (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Email</th>
                <th>Points</th>
                <th>Worth</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.email}>
                  <td>{b.name}</td>
                  <td>{b.email}</td>
                  <td>{b.available.toLocaleString()}</td>
                  <td>${((b.available * loyalty.centsPerPoint) / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="fine">Nobody has points yet.</p>
      )}

      <form className="admin-form" onSubmit={saveAdjust}>
        <fieldset>
          <legend>Add or remove points</legend>
          <label className="field">
            <span className="field-label">Guest email</span>
            <span className="field-input">
              <input type="email" value={adj.email} onChange={(e) => setAdj({ ...adj, email: e.target.value })} required />
            </span>
          </label>
          <label className="field">
            <span className="field-label">Points</span>
            <span className="field-input">
              <input
                inputMode="numeric"
                value={adj.points}
                placeholder="100 or -100"
                onChange={(e) => setAdj({ ...adj, points: e.target.value.replace(/[^\d-]/g, "") })}
                required
              />
            </span>
            <span className="field-hint">Negative to remove. Added points expire like earned ones.</span>
          </label>
          <label className="field">
            <span className="field-label">Note</span>
            <span className="field-input">
              <input value={adj.note} placeholder="Gift, correction…" onChange={(e) => setAdj({ ...adj, note: e.target.value })} />
            </span>
          </label>
          {error?.where === "adjust" && (
            <p className="notice error wide" role="alert">
              {error.text}
            </p>
          )}
          <div className="wide admin-actions">
            <button className="pay" type="submit" disabled={busy}>
              Save adjustment
            </button>
          </div>
        </fieldset>
      </form>

      <form className="admin-form" onSubmit={saveRules}>
        <fieldset>
          <legend>Rules</legend>
          <div className="field toggle-field wide">
            <label className="toggle">
              <input type="checkbox" role="switch" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              <span>{enabled ? "Program on" : "Program paused (guests keep their points but can't earn or use them)"}</span>
            </label>
          </div>
          {RULES.map((r) => (
            <label className="field" key={r.key}>
              <span className="field-label">{r.label}</span>
              <span className="field-input">
                <input
                  inputMode="numeric"
                  value={rules[r.key]}
                  onChange={(e) => setRules({ ...rules, [r.key]: e.target.value.replace(/\D/g, "") })}
                />
                {r.affix && <span className="affix">{r.affix}</span>}
              </span>
              {r.hint && <span className="field-hint">{r.hint}</span>}
            </label>
          ))}
          {error?.where === "rules" && (
            <p className="notice error wide" role="alert">
              {error.text}
            </p>
          )}
          <div className="wide admin-actions">
            <button className="pay" type="submit" disabled={busy}>
              Save rules
            </button>
          </div>
        </fieldset>
      </form>

      {reviewed.length > 0 && (
        <>
          <h2 className="admin-section">Reviewed</h2>
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Post</th>
                  <th>Likes / comments</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {reviewed.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.guest}
                      <br />
                      <span className="fine">{p.email}</span>
                    </td>
                    <td>
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="link">
                        Open ↗
                      </a>
                    </td>
                    <td>{p.status === "approved" ? `${p.likes ?? 0} / ${p.comments ?? 0}` : "—"}</td>
                    <td>
                      <span className={`pill ${p.status === "approved" ? "ok" : "off"}`}>
                        {p.status === "approved" ? `+${p.points ?? 0}` : "Rejected"}
                      </span>
                      {p.note && <span className="fine"> {p.note}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
