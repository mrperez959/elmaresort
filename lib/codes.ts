import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { query } from "./db";
import { sendMail } from "./mail";
import { allow } from "./ratelimit";

export type CodePurpose = "verify" | "reset" | "admin";

const TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;

function hash(code: string, email: string, purpose: string): string {
  const secret = process.env.SESSION_SECRET ?? "";
  return createHmac("sha256", secret).update(`${purpose}:${email.toLowerCase()}:${code}`).digest("hex");
}

export class CodeError extends Error {}

const SUBJECTS: Record<"en" | "es", Record<CodePurpose, string>> = {
  en: {
    verify: "Your Elma Resort verification code",
    reset: "Your Elma Resort password reset code",
    admin: "Your Elma Resort admin sign-in code",
  },
  es: {
    verify: "Tu código de verificación de Elma Resort",
    reset: "Tu código para cambiar la contraseña de Elma Resort",
    admin: "Tu código de acceso al panel de Elma Resort",
  },
};

const INTROS: Record<"en" | "es", Record<CodePurpose, string>> = {
  en: {
    verify: "Use this code to confirm your email:",
    reset: "Use this code to choose a new password:",
    admin: "Use this code to finish signing in to the admin panel:",
  },
  es: {
    verify: "Usa este código para confirmar tu email:",
    reset: "Usa este código para elegir una contraseña nueva:",
    admin: "Usa este código para terminar de entrar al panel:",
  },
};

/** Create and email a 6-digit code. Rate-limited per email and per IP. */
export async function sendCode(email: string, purpose: CodePurpose, ip: string, lang: "en" | "es" = "en"): Promise<void> {
  const e = email.toLowerCase();
  if (!(await allow(`code-gap:${purpose}:${e}`, 1, 45))) {
    throw new CodeError("Please wait a minute before asking for another code.");
  }
  if (!(await allow(`code-hour:${purpose}:${e}`, 5, 3600)) || !(await allow(`code-ip:${ip}`, 20, 3600))) {
    throw new CodeError("Too many codes requested. Try again in an hour.");
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  // Only the newest code works.
  await query("UPDATE email_codes SET used_at = now() WHERE email = $1 AND purpose = $2 AND used_at IS NULL", [e, purpose]);
  await query(
    `INSERT INTO email_codes (email, purpose, code_hash, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(mins => $4))`,
    [e, purpose, hash(code, e, purpose), TTL_MINUTES],
  );
  await sendMail(
    email,
    SUBJECTS[lang][purpose],
    lang === "es"
      ? `${INTROS.es[purpose]}\n\n    ${code}\n\nVence en ${TTL_MINUTES} minutos. Si no lo pediste, ignora este email.\n\nElma Resort`
      : `${INTROS.en[purpose]}\n\n    ${code}\n\nIt expires in ${TTL_MINUTES} minutes. If you didn't ask for it, ignore this email.\n\nElma Resort`,
  );
}

/** Check a code. Consumes it on success; counts failed attempts. */
export async function checkCode(email: string, purpose: CodePurpose, code: string): Promise<boolean> {
  const e = email.toLowerCase();
  const rows = await query<{ id: string; code_hash: string; attempts: number }>(
    `SELECT id, code_hash, attempts FROM email_codes
     WHERE email = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [e, purpose],
  );
  const row = rows[0];
  if (!row) throw new CodeError("That code has expired. Ask for a new one.");
  if (row.attempts >= MAX_ATTEMPTS) throw new CodeError("Too many wrong tries. Ask for a new code.");

  const given = Buffer.from(hash(code.replace(/\D/g, ""), e, purpose), "hex");
  const expected = Buffer.from(row.code_hash, "hex");
  if (given.length === expected.length && timingSafeEqual(given, expected)) {
    await query("UPDATE email_codes SET used_at = now() WHERE id = $1", [row.id]);
    return true;
  }
  await query("UPDATE email_codes SET attempts = attempts + 1 WHERE id = $1", [row.id]);
  return false;
}
