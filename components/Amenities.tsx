import {
  BedDouble,
  CookingPot,
  Flame,
  Gamepad2,
  PawPrint,
  Sailboat,
  Sun,
  Users,
  WashingMachine,
  Waves,
  type LucideIcon,
} from "lucide-react";
import type { AmenityIcon } from "@/lib/property";

const ICONS: Record<AmenityIcon, LucideIcon> = {
  water: Sailboat,
  "hot-tub": Waves,
  outdoor: Sun,
  fire: Flame,
  games: Gamepad2,
  bed: BedDouble,
  kitchen: CookingPot,
  laundry: WashingMachine,
  guests: Users,
  pets: PawPrint,
};

export function Amenities({ items }: { items: Array<{ icon: AmenityIcon; title: string; detail: string }> }) {
  return (
    <section className="amenities" aria-labelledby="amenities-heading">
      <h2 id="amenities-heading">What&apos;s here</h2>
      <ul>
        {items.map((a) => {
          const Icon = ICONS[a.icon];
          return (
            <li key={a.title}>
              <span className="amenity-icon" aria-hidden="true">
                <Icon size={22} strokeWidth={1.75} />
              </span>
              <div>
                <h3>{a.title}</h3>
                <p>{a.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
