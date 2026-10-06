import { AMENITY_ICONS } from "./amenity-icons";
import { AllAmenities } from "./AllAmenities";
import type { Amenity } from "@/lib/property";
import type { Lang } from "@/lib/i18n";

export function Amenities({ highlights, all, lang }: { highlights: Amenity[]; all: Amenity[]; lang: Lang }) {
  const es = lang === "es";
  return (
    <section className="amenities" aria-labelledby="amenities-heading">
      <h2 id="amenities-heading" data-reveal>{es ? "Lo que hay" : "What's here"}</h2>
      <div>
        <ul className="highlights" data-reveal-group>
          {highlights.map((a) => {
            const Icon = AMENITY_ICONS[a.icon];
            const detail = es ? a.detailEs : a.detail;
            return (
              <li key={a.title} data-reveal>
                <span className="amenity-icon" aria-hidden="true">
                  <Icon size={22} strokeWidth={1.75} />
                </span>
                <div>
                  <h3>{es ? a.titleEs : a.title}</h3>
                  {detail && <p>{detail}</p>}
                </div>
              </li>
            );
          })}
        </ul>
        <AllAmenities items={all} />
      </div>
    </section>
  );
}
