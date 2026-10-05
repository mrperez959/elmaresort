import "server-only";
import { sendMail } from "./mail";
import { allow } from "./ratelimit";

/**
 * Email the owner when something breaks in production. At most one email per
 * area every 30 minutes, so an outage doesn't flood the inbox. Never throws.
 */
export async function alertOwner(area: string, err: unknown, context = ""): Promise<void> {
  try {
    const to = process.env.ADMIN_EMAIL;
    if (!to || process.env.NODE_ENV !== "production") return;
    if (!(await allow(`alert:${area}`, 1, 1800))) return;
    const e = err as { message?: string; stack?: string; statusCode?: number; errors?: unknown };
    const body = [
      `Something failed on the website: ${area}`,
      context && `Context: ${context}`,
      `Error: ${e?.message ?? String(err)}`,
      e?.statusCode ? `Status: ${e.statusCode}` : "",
      e?.errors ? `Details: ${JSON.stringify(e.errors).slice(0, 1500)}` : "",
      "",
      "Check Vercel → Logs for the full details. You won't get another alert for this area for 30 minutes.",
      "",
      (e?.stack ?? "").split("\n").slice(0, 8).join("\n"),
    ]
      .filter((x) => x !== "")
      .join("\n");
    await sendMail(to, `[Elma Resort] Error: ${area}`, body);
  } catch (mailErr) {
    console.error("[alert] could not email the owner", mailErr);
  }
}
