import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { query } from "./db";

/** Secret part of the export URL, derived from SESSION_SECRET so it never needs storing. */
export function exportToken(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set.");
  return createHmac("sha256", secret).update("calendar-export-v1").digest("base64url").slice(0, 32);
}

export function exportTokenMatches(token: string): boolean {
  const a = Buffer.from(token);
  const b = Buffer.from(exportToken());
  return a.length === b.length && timingSafeEqual(a, b);
}

const ics = (d: string) => d.replaceAll("-", "");

/** iCalendar feed of confirmed direct bookings, for Airbnb/Vrbo "import calendar". No guest details. */
export async function buildExportCalendar(): Promise<string> {
  const rows = await query<{ code: string; start: string; end: string }>(
    `SELECT code, to_char(check_in, 'YYYY-MM-DD') AS start, to_char(check_out, 'YYYY-MM-DD') AS "end"
     FROM bookings WHERE status = 'confirmed' AND check_out >= CURRENT_DATE - 30 ORDER BY check_in`,
  );
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Elma Resort//Direct bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Elma Resort direct bookings",
    ...rows.flatMap((r) => [
      "BEGIN:VEVENT",
      `UID:${r.code}@elmaresort`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ics(r.start)}`,
      `DTEND;VALUE=DATE:${ics(r.end)}`,
      "SUMMARY:Reserved (direct booking)",
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
