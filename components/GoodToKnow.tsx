import { Clock, CalendarX, PawPrint } from "lucide-react";
import { POLICIES, GRACE_NOTE, FEES_NOTE, type PolicyId } from "@/lib/policy";
import { money } from "@/lib/format";

const hourLabel = (h: number) =>
  new Intl.DateTimeFormat("en-US", { hour: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 1, h)));

export function GoodToKnow(props: { policy: PolicyId; checkInHour: number; checkOutHour: number; maxPets: number; petFee: number }) {
  const p = POLICIES[props.policy];
  return (
    <section className="good-to-know" aria-labelledby="gtk-heading">
      <h2 id="gtk-heading">Good to know</h2>
      <div className="gtk-grid">
        <div>
          <h3>
            <Clock size={20} strokeWidth={1.75} aria-hidden="true" /> Check-in and check-out
          </h3>
          <p>
            Check-in after {hourLabel(props.checkInHour)}. Check-out by {hourLabel(props.checkOutHour)}.
          </p>
        </div>
        <div>
          <h3>
            <CalendarX size={20} strokeWidth={1.75} aria-hidden="true" /> Cancellation policy: {p.name}
          </h3>
          <p>{p.summary}</p>
          <p className="fine">
            {GRACE_NOTE} {FEES_NOTE} You can change or cancel your trip yourself from your account.
          </p>
        </div>
        <div>
          <h3>
            <PawPrint size={20} strokeWidth={1.75} aria-hidden="true" /> Pets
          </h3>
          <p>
            {props.maxPets > 0
              ? `Up to ${props.maxPets} ${props.maxPets === 1 ? "pet" : "pets"} welcome, ${money(props.petFee)} per stay.`
              : "Pets aren't allowed."}
          </p>
        </div>
      </div>
    </section>
  );
}
