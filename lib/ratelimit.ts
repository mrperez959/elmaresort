import "server-only";
import { query } from "./db";

/**
 * Fixed-window counter in Postgres. Returns true when the action is allowed
 * (and counts it), false when the limit for this window is used up.
 */
export async function allow(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const rows = await query<{ count: number }>(
    `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, now(), 1)
     ON CONFLICT (key) DO UPDATE SET
       window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2) THEN now() ELSE rate_limits.window_start END,
       count        = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2) THEN 1 ELSE rate_limits.count + 1 END
     RETURNING count`,
    [key, windowSeconds],
  );
  return rows[0].count <= limit;
}

/** Forget a counter, e.g. after a successful login. */
export async function reset(key: string): Promise<void> {
  await query("DELETE FROM rate_limits WHERE key = $1", [key]);
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
