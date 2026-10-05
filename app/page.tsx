import { Suspense } from "react";
import { BookingWidget } from "@/components/BookingWidget";
import { Gallery } from "@/components/Gallery";
import { SiteHeader } from "@/components/SiteHeader";
import { Amenities } from "@/components/Amenities";
import { Reviews } from "@/components/Reviews";
import { GoodToKnow } from "@/components/GoodToKnow";
import { AreaMap } from "@/components/AreaMap";
import { AMENITIES, HOUSE_AMENITIES, PHOTOS, type Amenity } from "@/lib/property";
import { getSettings, toPublicSettings } from "@/lib/settings";
import { getReviews } from "@/lib/reviews";
import { currentUser } from "@/lib/auth";
import { getL } from "@/lib/lang-server";
import { lines } from "@/lib/legal";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Streams in after the rest of the page so a slow review fetch never blocks it. */
async function ReviewsSection() {
  const summary = await getReviews();
  return summary ? <Reviews summary={summary} /> : null;
}

export default async function Home() {
  const [settings, user, { lang }] = await Promise.all([getSettings(), currentUser(), getL()]);

  const amenities: Amenity[] = [
    {
      icon: "guests",
      title: `Sleeps ${settings.maxGuests}`,
      titleEs: `Para ${settings.maxGuests} personas`,
      detail: "Plus infants. Room for the whole family or group.",
      detailEs: "Más bebés. Espacio para toda la familia o el grupo.",
    },
    ...(settings.maxPets > 0
      ? [
          {
            icon: "pets" as const,
            title: "Pet friendly",
            titleEs: "Se admiten mascotas",
            detail: `Up to ${settings.maxPets} ${settings.maxPets === 1 ? "pet" : "pets"}, ${money(settings.petFee)} per stay.`,
            detailEs: `Hasta ${settings.maxPets} ${settings.maxPets === 1 ? "mascota" : "mascotas"}, ${money(settings.petFee)} por estadía.`,
          },
        ]
      : []),
    ...AMENITIES,
  ];

  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  // Structured data so search engines understand this is a vacation rental. No street address.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VacationRental",
    name: process.env.NEXT_PUBLIC_PROPERTY_NAME ?? "Elma Resort",
    url: host ? `https://${host}` : undefined,
    image: PHOTOS.slice(0, 6).map((p) => `${host ? `https://${host}` : ""}${p.src}.webp`),
    address: { "@type": "PostalAddress", addressLocality: "Tampa", addressRegion: "FL", addressCountry: "US" },
    containsPlace: { "@type": "Accommodation", occupancy: { "@type": "QuantitativeValue", maxValue: settings.maxGuests } },
    amenityFeature: HOUSE_AMENITIES.map((a) => ({ "@type": "LocationFeatureSpecification", name: a.title, value: true })),
    petsAllowed: settings.maxPets > 0,
    ...(settings.reviewsAverage !== null && settings.reviewsCount
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: settings.reviewsAverage, reviewCount: settings.reviewsCount, bestRating: 5 } }
      : {}),
  };

  return (
    <main className="page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <SiteHeader user={user} />
      <Gallery photos={PHOTOS} />
      <Amenities highlights={amenities} all={HOUSE_AMENITIES} lang={lang} />
      <Suspense fallback={null}>
        <ReviewsSection />
      </Suspense>
      <GoodToKnow
        policy={settings.cancellationPolicy}
        checkInHour={settings.checkInHour}
        checkOutHour={settings.checkOutHour}
        maxPets={settings.maxPets}
        petFee={settings.petFee}
        rules={lines(lang === "es" ? settings.houseRulesEs : settings.houseRules)}
        lang={lang}
      />
      <AreaMap area={settings.approxArea} center={settings.mapCenter} zoom={settings.mapZoom} lang={lang} />
      <section id="book" aria-label={lang === "es" ? "Reserva tu estadía" : "Book your stay"}>
        <Suspense fallback={<p className="notice">…</p>}>
          <BookingWidget settings={toPublicSettings(settings)} />
        </Suspense>
      </section>
    </main>
  );
}
