import "server-only";
import { getFeed, feedLabel } from "./ical";
import { getSettings } from "./settings";
import { getReviews } from "./reviews";
import { todayAtProperty } from "./dates";

export type Check = { name: string; status: "ok" | "warn" | "error"; message: string };

/** Plain-language status of every outside connection, for the admin panel. */
export async function runChecks(): Promise<Check[]> {
  const checks: Check[] = [];
  const settings = await getSettings();
  const today = todayAtProperty();

  // Calendars
  if (settings.icalUrls.length === 0) {
    checks.push({
      name: "Calendars",
      status: "error",
      message: "No calendar links yet. Paste your Airbnb and Vrbo export links in the Calendars section below. Until then nobody can book.",
    });
  }
  for (const url of settings.icalUrls) {
    const name = `${feedLabel(url)} calendar`;
    try {
      const feed = await getFeed(url, { forBooking: true });
      const upcoming = feed.busy.filter((b) => b.end > today).length;
      checks.push({
        name,
        status: "ok",
        message: `Read ${feed.busy.length} blocked periods (${upcoming} upcoming).`,
      });
    } catch (err) {
      checks.push({ name, status: "error", message: (err as Error).message });
    }
  }
  const labels = settings.icalUrls.map(feedLabel);
  // A Hospitable export already contains the Airbnb and Vrbo reservations.
  const viaHospitable = labels.includes("Hospitable");
  for (const needed of viaHospitable ? [] : ["Airbnb", "Vrbo"]) {
    if (settings.icalUrls.length && !labels.includes(needed)) {
      checks.push({
        name: needed,
        status: "warn",
        message: `No ${needed} calendar link. If the home is listed there, add it so its bookings block the site.`,
      });
    }
  }

  // Square
  const sq = ["SQUARE_ACCESS_TOKEN", "NEXT_PUBLIC_SQUARE_APPLICATION_ID", "NEXT_PUBLIC_SQUARE_LOCATION_ID"].filter(
    (k) => !process.env[k],
  );
  const mode = process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox (test)";
  checks.push(
    sq.length
      ? { name: "Square", status: "error", message: `Missing ${sq.join(", ")}. Guests can't pay until these are set.` }
      : { name: "Square", status: "ok", message: `Configured in ${mode} mode.` },
  );

  // Tax
  checks.push(
    settings.taxes === null
      ? { name: "Taxes", status: "error", message: "Not set. Online booking stays closed until you set them below." }
      : {
          name: "Taxes",
          status: "ok",
          message: settings.taxes.length
            ? settings.taxes.map((t) => `${t.name} ${t.percent}%`).join(", ") +
              ` (total ${Math.round(settings.taxes.reduce((a, t) => a + t.percent, 0) * 1000) / 1000}%).`
            : "No taxes are charged.",
        },
  );

  // Reviews
  const reviews = await getReviews();
  checks.push(
    reviews
      ? { name: "Reviews", status: "ok", message: `${reviews.items.length} reviews on the site.` }
      : { name: "Reviews", status: "warn", message: "None yet. Add your rating and some reviews below to show the section." },
  );

  return checks;
}
