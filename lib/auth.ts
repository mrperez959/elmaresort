import "server-only";
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { findUserById } from "./users";
import type { PublicUser } from "./types";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

// ---------- Passwords ----------

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

// ---------- Signed session cookies ----------

const GUEST_COOKIE = "er_session";
const ADMIN_COOKIE = "er_admin";
const GUEST_DAYS = 30;
const ADMIN_HOURS = 12;

type Session = { sub: string; role: "guest" | "admin" | "admin-pending"; exp: number; v?: number };

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 random characters.");
  return s;
}

function sign(session: Session): string {
  const body = Buffer.from(JSON.stringify(session)).toString("base64url");
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function verify(token: string | undefined, role: Session["role"]): Session | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", secret()).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
    if (s.role !== role || s.exp < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

async function setCookie(name: string, value: string, maxAgeSeconds: number) {
  (await cookies()).set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function startGuestSession(userId: string, sessionVersion: number) {
  const exp = Date.now() + GUEST_DAYS * 86_400_000;
  await setCookie(GUEST_COOKIE, sign({ sub: userId, role: "guest", exp, v: sessionVersion }), GUEST_DAYS * 86_400);
}

export async function endGuestSession() {
  (await cookies()).delete(GUEST_COOKIE);
}

/** The signed-in guest, or null. */
export async function currentUser(): Promise<PublicUser | null> {
  const session = verify((await cookies()).get(GUEST_COOKIE)?.value, "guest");
  if (!session) return null;
  const user = await findUserById(session.sub);
  // A password reset bumps the version and signs out every old session.
  if (!user || (session.v ?? 1) !== user.sessionVersion) return null;
  const { sessionVersion: _v, ...publicUser } = user;
  return publicUser;
}

// ---------- Admin ----------

export function adminPasswordMatches(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length < 12) {
    throw new Error("ADMIN_PASSWORD must be set to at least 12 characters.");
  }
  const a = createHmac("sha256", "cmp").update(password).digest();
  const b = createHmac("sha256", "cmp").update(expected).digest();
  return timingSafeEqual(a, b);
}

const ADMIN_PENDING_COOKIE = "er_admin_pending";

/** Password was right; waiting for the emailed code. */
export async function startAdminPending() {
  const exp = Date.now() + 10 * 60_000;
  await setCookie(ADMIN_PENDING_COOKIE, sign({ sub: "admin", role: "admin-pending", exp }), 600);
}

export async function adminPending(): Promise<boolean> {
  return verify((await cookies()).get(ADMIN_PENDING_COOKIE)?.value, "admin-pending") !== null;
}

export async function startAdminSession() {
  (await cookies()).delete(ADMIN_PENDING_COOKIE);
  const exp = Date.now() + ADMIN_HOURS * 3_600_000;
  await setCookie(ADMIN_COOKIE, sign({ sub: "admin", role: "admin", exp }), ADMIN_HOURS * 3_600);
}

export async function endAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  return verify((await cookies()).get(ADMIN_COOKIE)?.value, "admin") !== null;
}

/**
 * Mutating API calls must send JSON and come from this same site. Blocks
 * cross-site form posts (CSRF) without needing tokens.
 */
export function isJsonRequest(req: Request): boolean {
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) return false;
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin fetches in some browsers omit it; cookies are SameSite=Lax anyway
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
