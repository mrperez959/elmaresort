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
  const events = rows.map((r) => [
    "BEGIN:VEVENT",
    `UID:${r.code}@elmaresort`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ics(r.start)}`,
    `DTEND;VALUE=DATE:${ics(r.end)}`,
    "SUMMARY:Reserved (direct booking)",
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
  ]);
  // A calendar with no events is invalid (RFC 5545 needs at least one), and some
  // importers reject it. Until there are real bookings, publish one night far in
  // the past: it blocks nothing.
  if (events.length === 0) {
    events.push([
      "BEGIN:VEVENT",
      "UID:placeholder@elmaresort",
      `DTSTAMP:${stamp}`,
      "DTSTART;VALUE=DATE:20200101",
      "DTEND;VALUE=DATE:20200102",
      "SUMMARY:Calendar created",
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    ]);
  }
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Elma Resort//Direct bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Elma Resort direct bookings",
    "X-WR-TIMEZONE:America/New_York",
    ...events.flat(),
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
