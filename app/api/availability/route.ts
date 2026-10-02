import { getDays } from "@/lib/hospitable";
import { addDays, todayAtProperty } from "@/lib/dates";
import type { PublicDay } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Next 12 months of availability and nightly prices. */
export async function GET() {
  try {
    const start = todayAtProperty();
    const days = await getDays(start, addDays(start, 365));
    const body: PublicDay[] = days.map((d) => ({
      date: d.date,
      available: d.available,
      price: d.price,
      minStay: d.minStay,
      closedForCheckin: d.closedForCheckin,
      closedForCheckout: d.closedForCheckout,
    }));
    return Response.json(
      { days: body },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
    );
  } catch (err) {
    console.error("[availability]", err);
    return Response.json({ error: "Availability couldn't be loaded." }, { status: 502 });
  }
}
