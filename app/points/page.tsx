import { pageMetadata } from "@/lib/seo";
import { LegalPage } from "@/components/LegalPage";
import { currentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getL } from "@/lib/lang-server";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return pageMetadata("/points", { en: "Elma Points", es: "Elma Points" });
}

export default async function Points() {
  const [user, settings, { l }] = await Promise.all([currentUser(), getSettings(), getL()]);
  const r = settings.loyalty;
  const hundred = money(100 * r.centsPerPoint);
  return (
    <LegalPage
      user={user}
      title="Elma Points"
      sections={[
        {
          h: l("How it works", "Cómo funciona"),
          p: [
            l(
              "Stayed with us? Share it on Instagram, tag @elmaresort (or invite us as a collaborator) and earn points for the likes and comments your post gets. Use them for a discount on your next booking.",
              "¿Te hospedaste con nosotros? Compártelo en Instagram, etiqueta a @elmaresort (o invítanos como colaborador) y gana puntos por los likes y comentarios de tu publicación. Úsalos como descuento en tu próxima reserva.",
            ),
            ...(r.enabled
              ? []
              : [l("The program is paused right now. Points you have are kept.", "El programa está en pausa ahora mismo. Los puntos que tienes se conservan.")]),
          ],
        },
        {
          h: l("Earning points", "Cómo ganar puntos"),
          p: [
            l(
              `${r.pointsPerLike} point per like and ${r.pointsPerComment} points per comment, up to ${r.maxPointsPerPost} points per post.`,
              `${r.pointsPerLike} punto por like y ${r.pointsPerComment} puntos por comentario, hasta ${r.maxPointsPerPost} puntos por publicación.`,
            ),
            l(
              "Only guests whose stay at Elma Resort has started can earn points from posts. Send the link from your account; we review each post and add your points, usually a few days after posting so the likes can add up.",
              "Solo pueden ganar puntos con publicaciones los huéspedes cuya estadía en Elma Resort ya empezó. Envía el enlace desde tu cuenta; revisamos cada publicación y sumamos tus puntos, normalmente unos días después para que se acumulen los likes.",
            ),
            l(
              "Your post must be public, show your stay, tag @elmaresort, and say clearly that you get points for it, for example #ad or “I earn Elma Points”. Advertising rules (FTC) require it. Posts with bought likes or comments, or that break Instagram's rules, aren't approved.",
              "Tu publicación debe ser pública, mostrar tu estadía, etiquetar a @elmaresort e indicar claramente que recibes puntos, por ejemplo #ad o “gano Elma Points”. Lo exigen las normas de publicidad (FTC). No se aprueban publicaciones con likes o comentarios comprados, ni las que no cumplan las reglas de Instagram.",
            ),
          ],
        },
        {
          h: l("Using points", "Cómo usar tus puntos"),
          p: [
            l(
              `100 points = ${hundred}. At checkout, tick “Use my Elma Points”. Points can cover up to ${r.maxDiscountPercent}% of the nightly price.`,
              `100 puntos = ${hundred}. Al pagar, marca “Usar mis Elma Points”. Los puntos pueden cubrir hasta el ${r.maxDiscountPercent}% del precio por noche.`,
            ),
            l(
              "If you cancel, the points you used come back to your account. If you change your trip, any points the new total doesn't need come back too.",
              "Si cancelas, los puntos que usaste vuelven a tu cuenta. Si cambias tu viaje, los puntos que el nuevo total no necesite también vuelven.",
            ),
            l(
              `Points expire ${r.expiryMonths} months after you get them. They have no cash value and can't be exchanged for money.`,
              `Los puntos vencen ${r.expiryMonths} meses después de recibirlos. No tienen valor en efectivo ni se pueden cambiar por dinero.`,
            ),
          ],
        },
        {
          h: l("Sending points to a friend", "Enviar puntos a un amigo"),
          p: [
            r.transferMonthlyCap > 0
              ? l(
                  `You can send points to another Elma Resort account with a confirmed email: at least ${r.transferMin} points at a time and up to ${r.transferMonthlyCap} points every 30 days. Transfers can't be undone.`,
                  `Puedes enviar puntos a otra cuenta de Elma Resort con email confirmado: mínimo ${r.transferMin} puntos por envío y hasta ${r.transferMonthlyCap} puntos cada 30 días. Los envíos no se pueden deshacer.`,
                )
              : l("Sending points is turned off right now.", "El envío de puntos está desactivado por ahora."),
          ],
        },
        {
          h: l("The fine print", "Letra pequeña"),
          p: [
            l(
              "We may change these rules or end the program; points you already have stay usable until they expire. We can remove points earned by mistake or through abuse.",
              "Podemos cambiar estas reglas o terminar el programa; los puntos que ya tengas seguirán sirviendo hasta que venzan. Podemos retirar puntos obtenidos por error o por abuso.",
            ),
          ],
        },
      ]}
    />
  );
}
