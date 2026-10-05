import { pageMetadata } from "@/lib/seo";
import { LegalPage } from "@/components/LegalPage";
import { currentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getL } from "@/lib/lang-server";
import { policyName, policySummary, graceNote, feesNote } from "@/lib/policy";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return pageMetadata("/refunds", { en: "Cancellation and refunds", es: "Cancelaciones y reembolsos" });
}

export default async function Refunds() {
  const [user, settings, { lang, l }] = await Promise.all([currentUser(), getSettings(), getL()]);
  const id = settings.cancellationPolicy;
  return (
    <LegalPage
      user={user}
      title={l("Cancellation and refunds", "Cancelaciones y reembolsos")}
      sections={[
        {
          h: l(`Cancellation policy: ${policyName(id, lang)}`, `Política de cancelación: ${policyName(id, lang)}`),
          p: [policySummary(id, lang), graceNote(lang), feesNote(lang)],
        },
        {
          h: l("Changes to your trip", "Cambios en tu viaje"),
          p: [
            l(
              "You can change your dates or number of guests from your account before check-in. If the new total is higher you pay the difference; if it's lower, the difference is refunded as the cancellation policy allows.",
              "Puedes cambiar las fechas o el número de huéspedes desde tu cuenta antes de la llegada. Si el nuevo total es mayor pagas la diferencia; si es menor, se devuelve lo que permite la política de cancelación.",
            ),
          ],
        },
        {
          h: l("How refunds are paid", "Cómo se pagan los reembolsos"),
          p: [
            l(
              "Refunds go back to the card used to pay. Banks usually take 5 to 10 business days to show them.",
              "Los reembolsos vuelven a la tarjeta con la que pagaste. Los bancos suelen tardar de 5 a 10 días hábiles en mostrarlos.",
            ),
            l(
              "Each booking keeps the policy that was in place when it was made.",
              "Cada reserva mantiene la política vigente al momento de reservar.",
            ),
          ],
        },
      ]}
    />
  );
}
