import { MapPin } from "lucide-react";

/** Public map of the general area only. The exact address is never sent to the browser here. */
export function AreaMap({ area }: { area: string }) {
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(area)}&z=13&output=embed`;
  return (
    <section className="area-map" aria-labelledby="map-heading">
      <div className="area-text">
        <h2 id="map-heading">Where you&apos;ll be</h2>
        <p className="area-name">
          <MapPin size={18} strokeWidth={1.75} aria-hidden="true" /> {area}
        </p>
        <p>
          A waterfront home on a canal. The exact address and check-in details appear in your trip on the day you
          arrive.
        </p>
      </div>
      <div className="map-frame">
        <iframe
          title={`Map of ${area}`}
          src={src}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </div>
    </section>
  );
}
