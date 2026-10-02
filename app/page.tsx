import { Suspense } from "react";
import { BookingWidget } from "@/components/BookingWidget";
import { Gallery } from "@/components/Gallery";
import { SiteHeader } from "@/components/SiteHeader";
import { AMENITIES, PHOTOS } from "@/lib/property";
import { getSettings, toPublicSettings } from "@/lib/settings";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [settings, user] = await Promise.all([getSettings(), currentUser()]);

  return (
    <main className="page">
      <SiteHeader user={user} />
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
          <BookingWidget settings={toPublicSettings(settings)} user={user} />
        </Suspense>
      </section>
    </main>
  );
}
