import "server-only";
import { AuthenticationError, NotFoundError, HospitableError } from "hospitable";
import { hospitable, getDays } from "./hospitable";
import { getSettings } from "./settings";
import { getReviews } from "./reviews";
import { addDays, todayAtProperty } from "./dates";

export type Check = { name: string; status: "ok" | "warn" | "error"; message: string };

function hospitableProblem(err: unknown): string {
  if (err instanceof AuthenticationError) {
    return err.statusCode === 403
      ? "The token doesn't have permission. Create one with read and write access in Hospitable (Apps → API access)."
      : "Hospitable rejected the token. It may be expired or mistyped: create a new one in Apps → API access and update HOSPITABLE_API_PAT.";
  }
  if (err instanceof HospitableError) return `Hospitable answered with an error (HTTP ${err.statusCode}).`;
  return `Couldn't reach Hospitable: ${(err as Error).message}`;
}

/** Plain-language status of every outside connection, for the admin panel. */
export async function runChecks(): Promise<Check[]> {
  const checks: Check[] = [];

  // Hospitable: token, property, calendar
  const token = process.env.HOSPITABLE_API_PAT;
  const propertyId = process.env.HOSPITABLE_PROPERTY_ID;
  if (!token || !propertyId) {
    checks.push({
      name: "Hospitable",
      status: "error",
      message: `Missing ${!token ? "HOSPITABLE_API_PAT" : "HOSPITABLE_PROPERTY_ID"} in Vercel's environment variables. Without it the calendar can't load.`,
    });
  } else {
    try {
      const p = await hospitable().properties.get(propertyId);
      checks.push({ name: "Hospitable", status: "ok", message: `Connected to "${p.publicName || p.name}".` });
      try {
        const today = todayAtProperty();
        const days = await getDays(today, addDays(today, 60), { fresh: true });
        const open = days.filter((d) => d.available).length;
        checks.push(
          open > 0
            ? { name: "Calendar", status: "ok", message: `${open} of the next ${days.length} nights are open.` }
            : {
                name: "Calendar",
                status: "warn",
                message: `Hospitable returned ${days.length} days but none are open in the next 60 nights. Check for blocks in Hospitable.`,
              },
        );
      } catch (err) {
        checks.push({ name: "Calendar", status: "error", message: hospitableProblem(err) });
      }
    } catch (err) {
      if (err instanceof NotFoundError) {
        let list = "";
        try {
          const props = await hospitable().properties.list();
          list = props.data.map((p) => `"${p.publicName || p.name}" = ${p.id}`).join("; ");
        } catch {
          /* ignore */
        }
        checks.push({
          name: "Hospitable",
          status: "error",
          message: `The token works but HOSPITABLE_PROPERTY_ID doesn't match any property.${list ? ` Your properties: ${list}` : ""}`,
        });
      } else {
        checks.push({ name: "Hospitable", status: "error", message: hospitableProblem(err) });
      }
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
  const settings = await getSettings();
  checks.push(
    settings.taxRatePercent === null
      ? { name: "Tax rate", status: "error", message: "Not set. Online booking stays closed until you set it below." }
      : { name: "Tax rate", status: "ok", message: `${settings.taxRatePercent}%.` },
  );

  // Reviews
  const reviews = await getReviews();
  checks.push(
    reviews
      ? { name: "Reviews", status: "ok", message: `${reviews.count} reviews, average ${reviews.average}.` }
      : { name: "Reviews", status: "warn", message: "No reviews loaded. The section stays hidden on the site." },
  );

  return checks;
}
