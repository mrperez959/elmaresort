import { House, MapPin } from "lucide-react";

/**
 * Public map of the general area only. The center is an approximate point the
 * owner picks near the house (never the address), with a circle on top.
 */
export function AreaMap({ area, center, zoom }: { area: string; center: string; zoom: number }) {
  const q = center ? center.replace(/\s+/g, "") : area;
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=${zoom}&output=embed`;
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
          className={center ? "map-static" : undefined}
          tabIndex={center ? -1 : undefined}
          title={`Map of ${area}`}
          src={src}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
        {center && (
          <>
            <span className="map-circle" aria-hidden="true" />
            {/* A map pin whose tip is on the point; it also covers Google's red pin. */}
            <span className="map-pin" aria-hidden="true">
              <span className="map-pin-head">
                <House size={22} strokeWidth={2.2} />
              </span>
            </span>
            <span className="map-caption">Approximate location</span>
          </>
        )}
      </div>
      {center && (
        <a
          className="manage-link map-open"
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(area)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Explore the area in Google Maps
        </a>
      )}
    </section>
  );
}
