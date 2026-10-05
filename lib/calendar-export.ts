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

/** RFC 5545 text escaping. */
const text = (v: string) => v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Fold lines longer than 75 bytes, as the standard requires. */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // don't cut a UTF-8 character in half
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    parts.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
    limit = 74; // continuation lines start with a space
  }
  return parts.join("\r\n ");
}

/**
 * iCalendar feed of confirmed direct bookings, for Hospitable (or Airbnb/Vrbo)
 * "import calendar". The link is secret; it carries the guest's name, party
 * size and contact so Hospitable shows who is coming. Airbnb/Vrbo ignore these
 * and only block the dates.
 */
export async function buildExportCalendar(): Promise<string> {
  const rows = await query<{
    code: string;
    start: string;
    end: string;
    adults: number;
    children: number;
    infants: number;
    pets: number;
    total_cents: number;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  }>(
    `SELECT b.code, to_char(b.check_in, 'YYYY-MM-DD') AS start, to_char(b.check_out, 'YYYY-MM-DD') AS "end",
            b.adults, b.children, b.infants, b.pets, b.total_cents, u.first_name, u.last_name, u.email, u.phone
     FROM bookings b JOIN users u ON u.id = b.user_id
     WHERE b.status = 'confirmed' AND b.check_out >= CURRENT_DATE - 30 ORDER BY b.check_in`,
  );
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const events = rows.map((r) => {
    const guests = r.adults + r.children;
    const party = [
      `${guests} ${guests === 1 ? "guest" : "guests"}`,
      r.infants ? `${r.infants} ${r.infants === 1 ? "infant" : "infants"}` : "",
      r.pets ? `${r.pets} ${r.pets === 1 ? "pet" : "pets"}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    const name = `${r.first_name} ${r.last_name}`;
    const description = [
      `Direct booking ${r.code}`,
      `Guest: ${name}`,
      `Party: ${r.adults} adults, ${r.children} children, ${r.infants} infants, ${r.pets} pets`,
      `Phone: ${r.phone}`,
      `Email: ${r.email}`,
      `Paid: $${(r.total_cents / 100).toFixed(2)}`,
    ].join("\n");
    return [
      "BEGIN:VEVENT",
      `UID:${r.code}@elmaresort`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ics(r.start)}`,
      `DTEND;VALUE=DATE:${ics(r.end)}`,
      `SUMMARY:${text(`${name} (${party}) ${r.code}`)}`,
      `DESCRIPTION:${text(description)}`,
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      "END:VEVENT",
    ];
  });
  // Owner blocks go out too, so Hospitable/Airbnb/Vrbo close those dates.
  const blocks = await query<{ id: string; start: string; end: string; note: string }>(
    `SELECT id, to_char(start_date, 'YYYY-MM-DD') AS start, to_char(end_date, 'YYYY-MM-DD') AS "end", note
     FROM owner_blocks WHERE end_date >= CURRENT_DATE - 30`,
  );
  for (const b of blocks) {
    events.push([
      "BEGIN:VEVENT",
      `UID:block-${b.id}@elmaresort`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ics(b.start)}`,
      `DTEND;VALUE=DATE:${ics(b.end)}`,
      `SUMMARY:${text(b.note ? `Blocked: ${b.note}` : "Blocked by owner")}`,
      "TRANSP:OPAQUE",
      "END:VEVENT",
    ]);
  }

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
    ...events.flat().map(fold),
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
