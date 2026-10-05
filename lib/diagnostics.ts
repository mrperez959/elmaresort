import "server-only";
import { getFeed, feedLabel } from "./ical";
import { getSettings } from "./settings";
import { getReviews } from "./reviews";
import { todayAtProperty } from "./dates";
import { square } from "./square";
import { mailConfigured, verifyMailConnection } from "./mail";

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

  // Email (verification codes, booking confirmations, admin sign-in codes)
  if (!mailConfigured()) {
    checks.push({
      name: "Email",
      status: "error",
      message: "Not set up. Guests can't confirm their email, so they can't book. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM.",
    });
  } else {
    try {
      await verifyMailConnection();
      checks.push({ name: "Email", status: "ok", message: `Sending as ${process.env.MAIL_FROM}.` });
    } catch (err) {
      checks.push({ name: "Email", status: "error", message: `The email server refused the login: ${(err as Error).message}` });
    }
  }
  const twoStep = process.env.ADMIN_2FA === "on";
  checks.push(
    !process.env.ADMIN_EMAIL
      ? {
          name: "Admin security",
          status: "warn",
          message: "Set ADMIN_EMAIL to get an email for every direct booking (and, optionally, sign-in codes).",
        }
      : twoStep
        ? { name: "Admin security", status: "ok", message: `Sign-in codes and booking alerts go to ${process.env.ADMIN_EMAIL}.` }
        : {
            name: "Admin security",
            status: "warn",
            message: `Booking alerts go to ${process.env.ADMIN_EMAIL}. Sign-in codes are off: once Email is green, add ADMIN_2FA=on in Vercel and redeploy.`,
          },
  );
  checks.push(
    process.env.CRON_SECRET
      ? { name: "Daily emails", status: "ok", message: "Check-in, thank-you and still-available emails run every morning." }
      : {
          name: "Daily emails",
          status: "warn",
          message: "Add CRON_SECRET in Vercel (any long random text) and redeploy to turn on the automatic daily emails.",
        },
  );
  checks.push(
    settings.checkInInstructions
      ? { name: "Check-in message", status: "ok", message: "Saved. It's emailed on the morning of each check-in." }
      : { name: "Check-in message", status: "warn", message: "Empty. Add your check-in day message below." },
  );
  checks.push(
    settings.propertyAddress
      ? { name: "Address", status: "ok", message: "Saved. Guests see it on their trip page from check-in day." }
      : { name: "Address", status: "warn", message: "Not set. Add the exact address below so guests get it on check-in day." },
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
