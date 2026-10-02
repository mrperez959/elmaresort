// Pure pricing math, shared by the server and the admin preview.
import type { Settings } from "./types";

export function weekendRate(s: Pick<Settings, "baseNightly" | "weekendMarkupPercent">): number {
  return Math.round(s.baseNightly * (1 + s.weekendMarkupPercent / 100));
}

export function isWeekendNight(date: string, s: Pick<Settings, "weekendNights">): boolean {
  return s.weekendNights.includes(new Date(`${date}T00:00:00Z`).getUTCDay());
}

/** Price of the night that starts on `date`. */
export function nightlyRate(date: string, s: Settings): number {
  return isWeekendNight(date, s) ? weekendRate(s) : s.baseNightly;
}
