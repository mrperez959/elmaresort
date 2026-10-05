import { pageMetadata } from "@/lib/seo";
import { LegalPage } from "@/components/LegalPage";
import { currentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getL } from "@/lib/lang-server";
import { rentalAgreement, AGREEMENT_VERSION } from "@/lib/legal";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return pageMetadata("/rental-agreement", { en: "Rental agreement", es: "Contrato de alquiler" });
}

export default async function Agreement() {
  const [user, settings, { lang, l }] = await Promise.all([currentUser(), getSettings(), getL()]);
  return (
    <LegalPage
      user={user}
      title={l("Rental agreement", "Contrato de alquiler")}
      sections={rentalAgreement(settings, lang, env.propertyName())}
      updated={l(`Version ${AGREEMENT_VERSION}`, `Versión ${AGREEMENT_VERSION}`)}
    />
  );
}
