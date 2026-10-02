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

type Session = { sub: string; role: "guest" | "admin"; exp: number };

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

export async function startGuestSession(userId: string) {
  const exp = Date.now() + GUEST_DAYS * 86_400_000;
  await setCookie(GUEST_COOKIE, sign({ sub: userId, role: "guest", exp }), GUEST_DAYS * 86_400);
}

export async function endGuestSession() {
  (await cookies()).delete(GUEST_COOKIE);
}

/** The signed-in guest, or null. */
export async function currentUser(): Promise<PublicUser | null> {
  const session = verify((await cookies()).get(GUEST_COOKIE)?.value, "guest");
  if (!session) return null;
  return findUserById(session.sub);
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

export async function startAdminSession() {
  const exp = Date.now() + ADMIN_HOURS * 3_600_000;
  await setCookie(ADMIN_COOKIE, sign({ sub: "admin", role: "admin", exp }), ADMIN_HOURS * 3_600);
}

export async function endAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  return verify((await cookies()).get(ADMIN_COOKIE)?.value, "admin") !== null;
}

// ---------- Brute-force brake (best effort, per server instance) ----------

const attempts = new Map<string, { count: number; until: number }>();

export function tooManyAttempts(key: string): boolean {
  const a = attempts.get(key);
  return Boolean(a && a.count >= 8 && a.until > Date.now());
}

export function recordFailedAttempt(key: string) {
  const a = attempts.get(key);
  if (!a || a.until < Date.now()) attempts.set(key, { count: 1, until: Date.now() + 15 * 60_000 });
  else a.count++;
}

export function clearAttempts(key: string) {
  attempts.delete(key);
}

export function clientKey(req: Request, extra = ""): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return `${ip}|${extra.toLowerCase()}`;
}

/** Reject cross-site form posts: our API only accepts JSON bodies. */
export function isJsonRequest(req: Request): boolean {
  return (req.headers.get("content-type") ?? "").includes("application/json");
}
