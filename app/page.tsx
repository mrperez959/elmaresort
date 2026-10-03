import { Suspense } from "react";
import { BookingWidget } from "@/components/BookingWidget";
import { Gallery } from "@/components/Gallery";
import { SiteHeader } from "@/components/SiteHeader";
import { Amenities } from "@/components/Amenities";
import { Reviews } from "@/components/Reviews";
import { AMENITIES, HOUSE_AMENITIES, PHOTOS } from "@/lib/property";
import { getSettings, toPublicSettings } from "@/lib/settings";
import { getReviews } from "@/lib/reviews";
import { currentUser } from "@/lib/auth";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Streams in after the rest of the page so a slow review fetch never blocks it. */
async function ReviewsSection() {
  const summary = await getReviews();
  return summary ? <Reviews summary={summary} /> : null;
}

export default async function Home() {
  const [settings, user] = await Promise.all([getSettings(), currentUser()]);

  const amenities = [
    { icon: "guests" as const, title: `Sleeps ${settings.maxGuests}`, detail: "Plus infants. Room for the whole family or group." },
    ...(settings.maxPets > 0
      ? [
          {
            icon: "pets" as const,
            title: "Pet friendly",
            detail: `Up to ${settings.maxPets} ${settings.maxPets === 1 ? "pet" : "pets"}, ${money(settings.petFee)} per stay.`,
          },
        ]
      : []),
    ...AMENITIES,
  ];

  return (
    <main className="page">
      <SiteHeader user={user} />
      <Gallery photos={PHOTOS} />
      <Amenities highlights={amenities} all={HOUSE_AMENITIES} />
      <Suspense fallback={null}>
        <ReviewsSection />
      </Suspense>
      <section id="book" aria-label="Book your stay">
        <Suspense fallback={<p className="notice">Loading…</p>}>
          <BookingWidget settings={toPublicSettings(settings)} />
        </Suspense>
      </section>
    </main>
  );
}
