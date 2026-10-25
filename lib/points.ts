import "server-only";
import { query, transaction } from "./db";
import { getSettings } from "./settings";
import { todayAtProperty } from "./dates";
import { sendMail } from "./mail";
import { computeBalance, pointsForPost, addMonths, type Balance, type LedgerRow } from "./points-math";
import type { Loyalty } from "./types";

type Q = <T extends import("pg").QueryResultRow>(text: string, params?: unknown[]) => Promise<T[]>;

export class PointsError extends Error {}

// ---------- Balance ----------

async function rowsFor(q: Q, userId: string): Promise<LedgerRow[]> {
  const rows = await q<{ delta: number; expires_on: string | null; created_on: string }>(
    `SELECT delta, to_char(expires_on, 'YYYY-MM-DD') AS expires_on,
            to_char(created_at AT TIME ZONE 'America/New_York', 'YYYY-MM-DD') AS created_on
     FROM points_ledger WHERE user_id = $1`,
    [userId],
  );
  return rows.map((r) => ({ delta: r.delta, expiresOn: r.expires_on, createdOn: r.created_on }));
}

export async function getBalance(userId: string, q: Q = query): Promise<Balance> {
  return computeBalance(await rowsFor(q, userId), todayAtProperty());
}

/** Serializes every balance change of one guest (transfers, checkout, adjustments). */
async function lock(q: Q, userId: string) {
  await q("SELECT pg_advisory_xact_lock(hashtext($1))", [`points:${userId}`]);
}

const expiry = (rules: Loyalty) => addMonths(todayAtProperty(), rules.expiryMonths);

// ---------- Earning: Instagram posts ----------

/** Guests earn points once their stay has started (a confirmed direct booking with check-in today or earlier). */
export async function canEarn(userId: string): Promise<boolean> {
  const rows = await query<{ ok: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM bookings WHERE user_id = $1 AND status = 'confirmed' AND check_in <= $2::date) AS ok`,
    [userId, todayAtProperty()],
  );
  return rows[0].ok;
}

/** https://www.instagram.com/p/ABC123/ (also /reel/ and /tv/, any host variant, query strings dropped). */
export function normalizeInstagramUrl(raw: string): string | null {
  let s = raw.trim();
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (!/(^|\.)instagram\.com$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/^\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([\w-]{5,40})\/?$/);
    if (!m) return null;
    const kind = m[1] === "reels" ? "reel" : m[1];
    return `https://www.instagram.com/${kind}/${m[2]}/`;
  } catch {
    return null;
  }
}

export async function submitPost(userId: string, rawUrl: string) {
  const { loyalty } = await getSettings();
  if (!loyalty.enabled) throw new PointsError("Elma Points are paused right now.");
  if (!(await canEarn(userId))) {
    throw new PointsError("You can earn points once your stay at Elma Resort has started.");
  }
  const url = normalizeInstagramUrl(rawUrl);
  if (!url) throw new PointsError("Paste the link to an Instagram post or reel (instagram.com/p/… or /reel/…).");
  const [{ pending, recent }] = await query<{ pending: string; recent: string }>(
    `SELECT count(*) FILTER (WHERE status = 'pending') AS pending,
            count(*) FILTER (WHERE created_at > now() - interval '30 days') AS recent
     FROM social_posts WHERE user_id = $1`,
    [userId],
  );
  if (Number(pending) >= 3) throw new PointsError("You already have 3 posts waiting for review. We'll get to them soon.");
  if (Number(recent) >= 10) throw new PointsError("You can send up to 10 posts every 30 days.");
  const rows = await query<{ id: string }>(
    "INSERT INTO social_posts (user_id, url) VALUES ($1, $2) ON CONFLICT (url) DO NOTHING RETURNING id",
    [userId, url],
  );
  if (!rows[0]) throw new PointsError("That post was already sent.");
  if (process.env.ADMIN_EMAIL) {
    sendMail(process.env.ADMIN_EMAIL, "New Instagram post for Elma Points", `${url}\n\nReview it in /admin/points.`).catch(
      (e) => console.error("[points] admin email failed", e),
    );
  }
}

export type PostView = { id: string; url: string; status: string; points: number | null; note: string; createdAt: string };

export async function userPosts(userId: string): Promise<PostView[]> {
  const rows = await query<{ id: string; url: string; status: string; points: number | null; admin_note: string; created_at: Date }>(
    "SELECT id, url, status, points, admin_note, created_at FROM social_posts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30",
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    status: r.status,
    points: r.points,
    note: r.admin_note,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export type HistoryRow = { delta: number; kind: string; note: string; date: string; expiresOn: string | null };

export async function userHistory(userId: string): Promise<HistoryRow[]> {
  const rows = await query<{ delta: number; kind: string; note: string; date: string; expires_on: string | null }>(
    `SELECT delta, kind, note, to_char(created_at AT TIME ZONE 'America/New_York', 'YYYY-MM-DD') AS date,
            to_char(expires_on, 'YYYY-MM-DD') AS expires_on
     FROM points_ledger WHERE user_id = $1 AND ref NOT LIKE 'pending:%' ORDER BY created_at DESC LIMIT 50`,
    [userId],
  );
  return rows.map((r) => ({ delta: r.delta, kind: r.kind, note: r.note, date: r.date, expiresOn: r.expires_on }));
}

// ---------- Transfers ----------

export async function transferPoints(sender: { id: string; email: string }, recipientEmail: string, amount: number) {
  const { loyalty } = await getSettings();
  if (!loyalty.enabled) throw new PointsError("Elma Points are paused right now.");
  if (loyalty.transferMonthlyCap <= 0) throw new PointsError("Point transfers are turned off.");
  const points = Math.floor(Number(amount));
  if (!Number.isFinite(points) || points < loyalty.transferMin) {
    throw new PointsError(`The minimum transfer is ${loyalty.transferMin} points.`);
  }
  const email = recipientEmail.trim().toLowerCase();
  if (email === sender.email.toLowerCase()) throw new PointsError("You can't send points to yourself.");
  const recipients = await query<{ id: string; first_name: string; verified: boolean }>(
    "SELECT id, first_name, email_verified_at IS NOT NULL AS verified FROM users WHERE email = $1",
    [email],
  );
  const to = recipients[0];
  // Same message whether the account is missing or unverified, so emails can't be probed.
  if (!to || !to.verified) throw new PointsError("We couldn't find a verified Elma Resort account with that email.");

  await transaction(async (q) => {
    for (const id of [sender.id, to.id].sort()) await lock(q, id);
    const bal = await getBalance(sender.id, q);
    if (points > bal.available) throw new PointsError(`You have ${bal.available} points available.`);
    const [{ sent }] = await q<{ sent: string }>(
      `SELECT coalesce(-sum(delta), 0) AS sent FROM points_ledger
       WHERE user_id = $1 AND kind = 'transfer_out' AND created_at > now() - interval '30 days'`,
      [sender.id],
    );
    const left = loyalty.transferMonthlyCap - Number(sent);
    if (points > left) {
      throw new PointsError(
        left > 0
          ? `You can send ${left} more points in the next 30 days.`
          : "You've reached the transfer limit for the last 30 days.",
      );
    }
    const ref = `transfer:${crypto.randomUUID()}`;
    await q("INSERT INTO points_ledger (user_id, delta, kind, ref, note) VALUES ($1, $2, 'transfer_out', $3, $4)", [
      sender.id,
      -points,
      ref,
      email,
    ]);
    await q(
      "INSERT INTO points_ledger (user_id, delta, kind, ref, note, expires_on) VALUES ($1, $2, 'transfer_in', $3, $4, $5)",
      [to.id, points, ref, sender.email.toLowerCase(), expiry(loyalty)],
    );
  });
  return { recipientName: to.first_name };
}

// ---------- Redeeming at checkout ----------

/**
 * Hold points for a payment in progress. Fails if the balance no longer covers them.
 * The hold is confirmed (bookingRedeemed) or released (releasePoints) right after the payment.
 */
export async function holdPoints(userId: string, points: number, key: string): Promise<boolean> {
  if (points <= 0) return true;
  return transaction(async (q) => {
    await lock(q, userId);
    const bal = await getBalance(userId, q);
    if (points > bal.available) return false;
    await q("INSERT INTO points_ledger (user_id, delta, kind, ref) VALUES ($1, $2, 'redeem', $3)", [
      userId,
      -points,
      `pending:${key}`,
    ]);
    return true;
  });
}

export async function bookingRedeemed(key: string, code: string) {
  await query("UPDATE points_ledger SET ref = $2, note = $3 WHERE ref = $1", [`pending:${key}`, `booking:${code}`, code]);
}

export async function releasePoints(key: string) {
  await query("DELETE FROM points_ledger WHERE ref = $1 AND kind = 'redeem'", [`pending:${key}`]);
}

/** Give points back to a guest (cancelled trip, or a change that used fewer points). */
export async function restorePoints(userId: string, points: number, code: string, note: string) {
  if (points <= 0) return;
  const { loyalty } = await getSettings();
  await query(
    "INSERT INTO points_ledger (user_id, delta, kind, ref, note, expires_on) VALUES ($1, $2, 'restore', $3, $4, $5)",
    [userId, points, `booking:${code}`, note, expiry(loyalty)],
  );
}

/** Extra points used by a trip change (the new stay used more than the old one). */
export async function chargeMorePoints(userId: string, points: number, code: string): Promise<boolean> {
  if (points <= 0) return true;
  return transaction(async (q) => {
    await lock(q, userId);
    const bal = await getBalance(userId, q);
    if (points > bal.available) return false;
    await q("INSERT INTO points_ledger (user_id, delta, kind, ref, note) VALUES ($1, $2, 'redeem', $3, $4)", [
      userId,
      -points,
      `booking:${code}`,
      code,
    ]);
    return true;
  });
}

// ---------- Admin ----------

export type AdminPost = PostView & {
  likes: number | null;
  comments: number | null;
  guest: string;
  email: string;
};

export async function adminPosts(status: "pending" | "reviewed"): Promise<AdminPost[]> {
  const rows = await query<{
    id: string;
    url: string;
    status: string;
    points: number | null;
    likes: number | null;
    comments: number | null;
    admin_note: string;
    created_at: Date;
    first_name: string;
    last_name: string;
    email: string;
  }>(
    `SELECT p.*, u.first_name, u.last_name, u.email FROM social_posts p JOIN users u ON u.id = p.user_id
     WHERE ${status === "pending" ? "p.status = 'pending'" : "p.status <> 'pending'"}
     ORDER BY ${status === "pending" ? "p.created_at" : "p.reviewed_at DESC"} LIMIT 100`,
  );
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    status: r.status,
    points: r.points,
    likes: r.likes,
    comments: r.comments,
    note: r.admin_note,
    createdAt: new Date(r.created_at).toISOString(),
    guest: `${r.first_name} ${r.last_name}`,
    email: r.email,
  }));
}

export async function approvePost(id: string, likes: number, comments: number, pointsOverride: number | null) {
  const { loyalty } = await getSettings();
  const l = Math.max(0, Math.floor(likes));
  const c = Math.max(0, Math.floor(comments));
  const points = pointsOverride !== null ? Math.max(0, Math.floor(pointsOverride)) : pointsForPost(l, c, loyalty);
  const post = await transaction(async (q) => {
    const rows = await q<{ user_id: string; url: string }>(
      `UPDATE social_posts SET status = 'approved', likes = $2, comments = $3, points = $4, reviewed_at = now()
       WHERE id = $1 AND status = 'pending' RETURNING user_id, url`,
      [id, l, c, points],
    );
    if (!rows[0]) throw new PointsError("That post was already reviewed.");
    if (points > 0) {
      await q(
        "INSERT INTO points_ledger (user_id, delta, kind, ref, note, expires_on) VALUES ($1, $2, 'earn', $3, $4, $5)",
        [rows[0].user_id, points, `post:${id}`, rows[0].url, expiry(loyalty)],
      );
    }
    return rows[0];
  });
  notifyGuest(post.user_id, points, null, loyalty).catch((e) => console.error("[points] guest email failed", e));
  return { points };
}

export async function rejectPost(id: string, note: string) {
  const rows = await query<{ user_id: string }>(
    `UPDATE social_posts SET status = 'rejected', admin_note = $2, points = 0, reviewed_at = now()
     WHERE id = $1 AND status = 'pending' RETURNING user_id`,
    [id, note.slice(0, 300)],
  );
  if (!rows[0]) throw new PointsError("That post was already reviewed.");
  const { loyalty } = await getSettings();
  notifyGuest(rows[0].user_id, 0, note, loyalty).catch((e) => console.error("[points] guest email failed", e));
}

export async function adjustPoints(email: string, delta: number, note: string) {
  const { loyalty } = await getSettings();
  const d = Math.trunc(Number(delta));
  if (!d) throw new PointsError("Enter the points to add (or a negative number to remove).");
  const users = await query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email.trim().toLowerCase()]);
  if (!users[0]) throw new PointsError("No account with that email.");
  await query(
    "INSERT INTO points_ledger (user_id, delta, kind, ref, note, expires_on) VALUES ($1, $2, 'adjust', 'admin', $3, $4)",
    [users[0].id, d, note.slice(0, 200), d > 0 ? expiry(loyalty) : null],
  );
}

export async function topBalances(): Promise<Array<{ name: string; email: string; available: number }>> {
  const users = await query<{ id: string; first_name: string; last_name: string; email: string }>(
    `SELECT DISTINCT u.id, u.first_name, u.last_name, u.email FROM users u JOIN points_ledger p ON p.user_id = u.id`,
  );
  const out = [];
  for (const u of users) {
    const b = await getBalance(u.id);
    if (b.available > 0) out.push({ name: `${u.first_name} ${u.last_name}`, email: u.email, available: b.available });
  }
  return out.sort((a, b) => b.available - a.available).slice(0, 50);
}

async function notifyGuest(userId: string, points: number, rejectNote: string | null, rules: Loyalty) {
  const rows = await query<{ email: string; first_name: string; lang: string }>(
    "SELECT email, first_name, lang FROM users WHERE id = $1",
    [userId],
  );
  const u = rows[0];
  if (!u) return;
  const es = u.lang === "es";
  const value = `$${((points * rules.centsPerPoint) / 100).toFixed(2)}`;
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const link = host ? `https://${host}/account` : "/account";
  if (rejectNote !== null) {
    await sendMail(
      u.email,
      es ? "Sobre tu publicación para Elma Points" : "About your post for Elma Points",
      es
        ? `Hola ${u.first_name},\n\nRevisamos tu publicación, pero esta vez no pudimos darle puntos.${rejectNote ? `\n\nMotivo: ${rejectNote}` : ""}\n\nPuedes ver las reglas y enviar otra desde tu cuenta: ${link}\n\nElma Resort`
        : `Hi ${u.first_name},\n\nWe reviewed your post, but this time it didn't qualify for points.${rejectNote ? `\n\nReason: ${rejectNote}` : ""}\n\nYou can see the rules and send another one from your account: ${link}\n\nElma Resort`,
    );
    return;
  }
  await sendMail(
    u.email,
    es ? `Ganaste ${points} Elma Points` : `You earned ${points} Elma Points`,
    es
      ? `Hola ${u.first_name},\n\n¡Gracias por compartir tu estadía! Sumamos ${points} puntos a tu cuenta (${value} de descuento en tu próxima reserva directa).\n\nVe tu saldo: ${link}\n\nElma Resort`
      : `Hi ${u.first_name},\n\nThanks for sharing your stay! We added ${points} points to your account (${value} off your next direct booking).\n\nSee your balance: ${link}\n\nElma Resort`,
  );
}
