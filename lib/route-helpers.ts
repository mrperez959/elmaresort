import "server-only";
import { isJsonRequest } from "./auth";

export const fail = (error: string, status = 400) => Response.json({ error }, { status });

/** Parse a JSON body from a same-site request, or return an error Response. */
export async function readJson(req: Request): Promise<Record<string, unknown> | Response> {
  if (!isJsonRequest(req)) return fail("Unsupported request.", 415);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail("Invalid request.");
  return body as Record<string, unknown>;
}

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function passwordProblem(password: string, email: string): string | null {
  if (password.length < 10) return "Use a password of at least 10 characters.";
  if (password.length > 200) return "That password is too long.";
  if (password.toLowerCase().includes(email.split("@")[0].toLowerCase()) && email.split("@")[0].length >= 4) {
    return "Don't use your email in your password.";
  }
  return null;
}
