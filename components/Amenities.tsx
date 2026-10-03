import { AMENITY_ICONS } from "./amenity-icons";
import { AllAmenities } from "./AllAmenities";
import type { AmenityIcon } from "@/lib/property";

type Item = { icon: AmenityIcon; title: string; detail?: string };

export function Amenities({ highlights, all }: { highlights: Item[]; all: Item[] }) {
  return (
    <section className="amenities" aria-labelledby="amenities-heading">
      <h2 id="amenities-heading">What&apos;s here</h2>
      <div>
        <ul className="highlights">
          {highlights.map((a) => {
            const Icon = AMENITY_ICONS[a.icon];
            return (
              <li key={a.title}>
                <span className="amenity-icon" aria-hidden="true">
                  <Icon size={22} strokeWidth={1.75} />
                </span>
                <div>
                  <h3>{a.title}</h3>
                  {a.detail && <p>{a.detail}</p>}
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
