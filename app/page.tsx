import { Suspense } from "react";
import { BookingWidget } from "@/components/BookingWidget";
import { Gallery } from "@/components/Gallery";
import { AMENITIES, PHOTOS } from "@/lib/property";

export default function Home() {
  const name = process.env.NEXT_PUBLIC_PROPERTY_NAME ?? "Vacation rental";
  const location = process.env.NEXT_PUBLIC_PROPERTY_LOCATION ?? "";
  const tagline = process.env.NEXT_PUBLIC_PROPERTY_TAGLINE ?? "";
  const maxGuests = Number(process.env.NEXT_PUBLIC_MAX_GUESTS ?? 6) || 6;

  return (
    <main className="page">
      <header className="masthead">
        <h1>{name}</h1>
        <p className="place">
          {location}
          {location && tagline ? <br /> : null}
          {tagline}
        </p>
      </header>

      <Gallery photos={PHOTOS} />

      <section className="amenities" aria-labelledby="amenities-heading">
        <h2 id="amenities-heading">What&apos;s here</h2>
        <dl>
          {AMENITIES.map((a) => (
            <div key={a.title}>
              <dt>{a.title}</dt>
              <dd>{a.detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="book" aria-label="Book your stay">
        <Suspense fallback={<p className="notice">Loading…</p>}>
          <BookingWidget maxGuests={maxGuests} />
        </Suspense>
      </section>
    </main>
  );
}
