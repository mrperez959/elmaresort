import "server-only";
import { getFeed, feedLabel } from "./ical";
import { getSettings } from "./settings";
import { getReviews } from "./reviews";
import { todayAtProperty } from "./dates";
import { square } from "./square";

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
  const mode = process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";
  if (sq.length) {
    checks.push({ name: "Square", status: "error", message: `Missing ${sq.join(", ")}. Guests can't pay until these are set.` });
  } else {
    const appId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID!;
    const production = process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === "production";
    if (appId.startsWith("sandbox-") === production) {
      checks.push({
        name: "Square",
        status: "error",
        message: production
          ? "NEXT_PUBLIC_SQUARE_ENVIRONMENT is production but the Application ID is a Sandbox one."
          : "The Application ID is a Production one. Set NEXT_PUBLIC_SQUARE_ENVIRONMENT to production, or use the Sandbox Application ID.",
      });
    } else {
      try {
        const res = await square().locations.get({ locationId: process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID! });
        checks.push({
          name: "Square",
          status: "ok",
          message: `Connected in ${mode} mode to location "${res.location?.name ?? "?"}".`,
        });
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        checks.push({
          name: "Square",
          status: "error",
          message:
            code === 401
              ? `Square rejected SQUARE_ACCESS_TOKEN. Copy the full ${mode} Access token again (Credentials → Show) and redeploy.`
              : code === 404 || code === 400
                ? `The Location ID doesn't belong to this ${mode} account. Copy it from Developer Console → Locations with the ${production ? "Production" : "Sandbox"} tab selected.`
                : `Couldn't check Square: ${(err as Error).message}`,
        });
      }
    }
  }

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
