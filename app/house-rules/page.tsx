import { LegalPage } from "@/components/LegalPage";
import { currentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getL } from "@/lib/lang-server";
import { houseRules } from "@/lib/legal";

export const dynamic = "force-dynamic";
export const metadata = { title: "House rules" };

export default async function HouseRules() {
  const [user, settings, { lang, l }] = await Promise.all([currentUser(), getSettings(), getL()]);
  return (
    <LegalPage
      user={user}
      title={l("House rules", "Reglas de la casa")}
      intro={l(
        "By booking, you agree to these rules for you and everyone in your group.",
        "Al reservar, aceptas estas reglas para ti y para todo tu grupo.",
      )}
      sections={[{ h: l("Rules", "Reglas"), p: houseRules(settings, lang).map((r) => `• ${r}`) }]}
    />
  );
}
