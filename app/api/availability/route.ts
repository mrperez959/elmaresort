import { getDays } from "@/lib/hospitable";
import { getSettings } from "@/lib/settings";
import { nightlyRate } from "@/lib/pricing";
import { addDays, todayAtProperty } from "@/lib/dates";
import type { PublicDay } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Next 12 months: availability from Hospitable, prices from the admin settings. */
export async function GET() {
  try {
    const start = todayAtProperty();
    const [days, settings] = await Promise.all([getDays(start, addDays(start, 365)), getSettings()]);
    const body: PublicDay[] = days.map((d) => ({
      date: d.date,
      available: d.available,
      price: nightlyRate(d.date, settings),
      minStay: d.minStay,
      closedForCheckin: d.closedForCheckin,
      closedForCheckout: d.closedForCheckout,
    }));
    return Response.json(
      { days: body },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } },
    );
  } catch (err) {
    console.error("[availability]", err);
    return Response.json({ error: "Availability couldn't be loaded." }, { status: 502 });
  }
}
