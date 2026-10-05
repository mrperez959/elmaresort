import { Clock, CalendarX, PawPrint } from "lucide-react";
import Link from "next/link";
import { policyName, policySummary, graceNote, feesNote, type PolicyId } from "@/lib/policy";
import { money, hourLabel } from "@/lib/format";
import { makeL, type Lang } from "@/lib/i18n";

export function GoodToKnow(props: {
  policy: PolicyId;
  checkInHour: number;
  checkOutHour: number;
  maxPets: number;
  petFee: number;
  rules: string[];
  lang: Lang;
}) {
  const { lang } = props;
  const l = makeL(lang);
  return (
    <section className="good-to-know" aria-labelledby="gtk-heading">
      <h2 id="gtk-heading">{l("Good to know", "Para saber")}</h2>
      <div className="gtk-grid">
        <div>
          <h3>
            <Clock size={20} strokeWidth={1.75} aria-hidden="true" /> {l("Check-in and house rules", "Llegada y reglas")}
          </h3>
          <p>
            {l(
              `Check-in after ${hourLabel(props.checkInHour, lang)}. Check-out by ${hourLabel(props.checkOutHour, lang)}.`,
              `Llegada desde las ${hourLabel(props.checkInHour, lang)}. Salida antes de las ${hourLabel(props.checkOutHour, lang)}.`,
            )}
          </p>
          {props.rules.map((r) => (
            <p key={r}>{r}</p>
          ))}
          <p>
            <Link href="/house-rules" className="manage-link">
              {l("All house rules", "Todas las reglas")}
            </Link>
          </p>
        </div>
        <div>
          <h3>
            <CalendarX size={20} strokeWidth={1.75} aria-hidden="true" /> {l("Cancellation policy", "Política de cancelación")}:{" "}
            {policyName(props.policy, lang)}
          </h3>
          <p>{policySummary(props.policy, lang)}</p>
          <p className="fine">
            {graceNote(lang)} {feesNote(lang)}{" "}
            {l("You can change or cancel your trip yourself from your account.", "Puedes cambiar o cancelar tu viaje tú mismo desde tu cuenta.")}
          </p>
        </div>
        <div>
          <h3>
            <PawPrint size={20} strokeWidth={1.75} aria-hidden="true" /> {l("Pets", "Mascotas")}
          </h3>
          <p>
            {props.maxPets > 0
              ? l(
                  `Up to ${props.maxPets} ${props.maxPets === 1 ? "pet" : "pets"} welcome, ${money(props.petFee)} per stay.`,
                  `Se admiten hasta ${props.maxPets} ${props.maxPets === 1 ? "mascota" : "mascotas"}, ${money(props.petFee)} por estadía.`,
                )
              : l("Pets aren't allowed.", "No se admiten mascotas.")}
          </p>
        </div>
      </div>
    </section>
  );
}
