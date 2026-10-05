import "server-only";
import { getFeed, type Busy } from "./ical";
import { getSettings } from "./settings";
import { query } from "./db";
import { addDays } from "./dates";

export type Replacing = { id: string; start: string; end: string };

export type Day = {
  date: string;
  available: boolean;
  minStay: number;
  closedForCheckin: boolean;
  closedForCheckout: boolean;
};

/** Nights already sold on this website (confirmed bookings). */
/** Dates the owner blocked by hand in /admin. */
async function ownerBlocks(): Promise<Busy[]> {
  return query<{ start: string; end: string }>(
    `SELECT to_char(start_date, 'YYYY-MM-DD') AS start, to_char(end_date, 'YYYY-MM-DD') AS "end"
     FROM owner_blocks WHERE end_date >= CURRENT_DATE - 1`,
  );
}

async function directBookings(excludeId?: string): Promise<Busy[]> {
  const rows = await query<{ start: string; end: string }>(
    `SELECT to_char(check_in, 'YYYY-MM-DD') AS start, to_char(check_out, 'YYYY-MM-DD') AS "end"
     FROM bookings WHERE status = 'confirmed' AND check_out >= CURRENT_DATE - 1
       AND ($1::uuid IS NULL OR id <> $1::uuid)`,
    [excludeId ?? null],
  );
  return rows;
}

/**
 * Calendar days from `start` to `end` inclusive. A night is open when no
 * Airbnb/Vrbo feed and no direct booking covers it. When a guest changes their
 * own trip, their current booking is left out (it's being replaced).
 */
export async function getDays(
  start: string,
  end: string,
  { forBooking = false, replacing }: { forBooking?: boolean; replacing?: Replacing } = {},
): Promise<Day[]> {
  const settings = await getSettings();
  if (settings.icalUrls.length === 0) {
    throw new Error("No calendar links configured. Add your Airbnb and Vrbo export links in /admin.");
  }
  const [feeds, direct, blocks] = await Promise.all([
    Promise.all(settings.icalUrls.map((u) => getFeed(u, { forBooking }))),
    directBookings(replacing?.id),
    ownerBlocks(),
  ]);
  // Airbnb/Hospitable re-publish our own direct bookings (we export them), so
  // when a guest changes their trip, ignore the span that is exactly their current stay.
  const external = feeds
    .flatMap((f) => f.busy)
    .filter((b) => !(replacing && b.start === replacing.start && b.end === replacing.end));
  const busy = [...external, ...direct, ...blocks].filter((b) => b.end > start && b.start <= end);

  const days: Day[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    days.push({
      date: d,
      available: !busy.some((b) => d >= b.start && d < b.end),
      minStay: settings.minNights,
      closedForCheckin: false,
      closedForCheckout: false,
    });
  }
  return days;
}
