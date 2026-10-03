import "server-only";
import { getFeed, type Busy } from "./ical";
import { getSettings } from "./settings";
import { query } from "./db";
import { addDays } from "./dates";

export type Day = {
  date: string;
  available: boolean;
  minStay: number;
  closedForCheckin: boolean;
  closedForCheckout: boolean;
};

/** Nights already sold on this website (confirmed bookings). */
async function directBookings(): Promise<Busy[]> {
  const rows = await query<{ start: string; end: string }>(
    `SELECT to_char(check_in, 'YYYY-MM-DD') AS start, to_char(check_out, 'YYYY-MM-DD') AS "end"
     FROM bookings WHERE status = 'confirmed' AND check_out >= CURRENT_DATE - 1`,
  );
  return rows;
}

/**
 * Calendar days from `start` to `end` inclusive. A night is open when no
 * Airbnb/Vrbo feed and no direct booking covers it.
 */
export async function getDays(
  start: string,
  end: string,
  { forBooking = false }: { forBooking?: boolean } = {},
): Promise<Day[]> {
  const settings = await getSettings();
  if (settings.icalUrls.length === 0) {
    throw new Error("No calendar links configured. Add your Airbnb and Vrbo export links in /admin.");
  }
  const [feeds, direct] = await Promise.all([
    Promise.all(settings.icalUrls.map((u) => getFeed(u, { forBooking }))),
    directBookings(),
  ]);
  const busy = [...feeds.flatMap((f) => f.busy), ...direct].filter((b) => b.end > start && b.start <= end);

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
