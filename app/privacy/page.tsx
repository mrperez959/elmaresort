import { LegalPage } from "@/components/LegalPage";
import { currentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getL } from "@/lib/lang-server";
import { privacyPolicy, AGREEMENT_VERSION } from "@/lib/legal";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Privacy policy" };

export default async function Privacy() {
  const [user, settings, { lang, l }] = await Promise.all([currentUser(), getSettings(), getL()]);
  return (
    <LegalPage
      user={user}
      title={l("Privacy policy", "Política de privacidad")}
      sections={privacyPolicy(lang, env.propertyName(), settings.contactEmail)}
      updated={l(`Last updated ${AGREEMENT_VERSION}`, `Actualizada ${AGREEMENT_VERSION}`)}
    />
  );
}
