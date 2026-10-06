import { House, MapPin } from "lucide-react";
import { makeL, type Lang } from "@/lib/i18n";

/**
 * Public map of the general area only. The center is an approximate point the
 * owner picks near the house (never the address), with a circle on top.
 */
export function AreaMap({
  area,
  center,
  zoom,
  lang,
  nearby = [],
}: {
  area: string;
  center: string;
  zoom: number;
  lang: Lang;
  nearby?: Array<{ name: string; minutes: number }>;
}) {
  const l = makeL(lang);
  const q = center ? center.replace(/\s+/g, "") : area;
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=${zoom}&hl=${lang}&output=embed`;
  return (
    <section className="area-map" aria-labelledby="map-heading">
      <div className="area-text" data-reveal>
        <h2 id="map-heading">{l("Where you'll be", "Dónde vas a estar")}</h2>
        <p className="area-name">
          <MapPin size={18} strokeWidth={1.75} aria-hidden="true" /> {area}
        </p>
        <p>
          {l(
            "A waterfront home on a canal. The exact address and check-in details appear in your trip on the day you arrive.",
            "Una casa frente a un canal. La dirección exacta y los detalles de llegada aparecen en tu viaje el día que llegas.",
          )}
        </p>
        {nearby.length > 0 && (
          <>
            <h3 className="nearby-title">{l("Driving time from the house", "En auto desde la casa")}</h3>
            <ul className="nearby">
              {nearby.map((n) => (
                <li key={n.name}>
                  <span>{n.name}</span>
                  <span>{l(`${n.minutes} min`, `${n.minutes} min`)}</span>
                </li>
              ))}
            </ul>
            <p className="fine">{l("Approximate, without traffic.", "Aproximado, sin tráfico.")}</p>
          </>
        )}
      </div>
      <div className="map-frame" data-reveal="map">
        <iframe
          className={center ? "map-static" : undefined}
          tabIndex={center ? -1 : undefined}
          title={l(`Map of ${area}`, `Mapa de ${area}`)}
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
            <span className="map-caption">{l("Approximate location", "Ubicación aproximada")}</span>
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
          {l("Explore the area in Google Maps", "Explora la zona en Google Maps")}
        </a>
      )}
    </section>
  );
}
