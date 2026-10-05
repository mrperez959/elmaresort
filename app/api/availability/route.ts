import { getDays } from "@/lib/availability";
import { allow, clientIp } from "@/lib/ratelimit";
import { alertOwner } from "@/lib/alerts";
import { getSettings } from "@/lib/settings";
import { nightlyRate } from "@/lib/pricing";
import { addDays, todayAtProperty } from "@/lib/dates";
import type { PublicDay } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Next 12 months: busy dates from Airbnb/Vrbo + direct bookings, prices from /admin. */
export async function GET(req: Request) {
  if (!(await allow(`avail:${clientIp(req)}`, 60, 60))) {
    return Response.json({ error: "Too many requests. Wait a moment." }, { status: 429 });
  }
  try {
    const start = todayAtProperty();
    const [days, settings] = await Promise.all([getDays(start, addDays(start, 365)), getSettings()]);
    const body: PublicDay[] = days.map((d) => ({ ...d, price: nightlyRate(d.date, settings) }));
    return Response.json({ days: body }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[availability]", err);
    await alertOwner("calendar availability", err);
    return Response.json({ error: "Availability couldn't be loaded." }, { status: 502 });
  }
}
