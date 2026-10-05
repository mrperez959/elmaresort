import "server-only";
import { sendMail } from "./mail";
import { env } from "./env";
import { getSettings } from "./settings";
import { checkInMessage } from "./legal";
import type { Quote } from "./types";

type Lang = "en" | "es";
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

function siteUrl(): string {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return host ? `https://${host}` : "http://localhost:3000";
}

function receiptLines(q: Quote, lang: Lang): string {
  const es = lang === "es";
  const guests = q.adults + q.children;
  return [
    `${es ? "Fechas" : "Dates"}: ${q.checkIn} ${es ? "al" : "to"} ${q.checkOut} (${q.nights} ${es ? "noches" : "nights"})`,
    `${es ? "Huéspedes" : "Guests"}: ${guests}${q.infants ? ` + ${q.infants} ${es ? "bebés" : "infants"}` : ""}${q.pets ? `, ${q.pets} ${es ? "mascotas" : "pets"}` : ""}`,
    `${es ? "Total antes de impuestos" : "Total before taxes"}: ${usd(q.subtotal)}`,
    `${es ? "Impuestos" : "Taxes"}: ${usd(q.tax)}`,
    `${es ? "Total pagado" : "Total paid"}: ${usd(q.total)}`,
  ].join("\n");
}

export async function sendBookingConfirmation(to: string, firstName: string, lang: Lang, code: string, q: Quote) {
  const name = env.propertyName();
  const es = lang === "es";
  await sendMail(
    to,
    es ? `Reserva confirmada en ${name} (${code})` : `You're booked at ${name} (${code})`,
    es
      ? `Hola ${firstName},\n\nTu estadía está confirmada.\n\n${receiptLines(q, lang)}\nCódigo de confirmación: ${code}\n\nEn tu cuenta puedes ver el recibo, cambiar o cancelar el viaje: ${siteUrl()}/account\n\nEl día de tu llegada te enviaremos por email la dirección y las instrucciones para entrar.\n\n${name}`
      : `Hi ${firstName},\n\nYour stay is confirmed.\n\n${receiptLines(q, lang)}\nConfirmation code: ${code}\n\nSee your receipt, change or cancel your trip from your account: ${siteUrl()}/account\n\nOn your check-in day we'll email you the address and instructions to get in.\n\n${name}`,
  );
}

export async function sendCheckInDay(to: string, firstName: string, lang: Lang, code: string) {
  const s = await getSettings();
  const name = env.propertyName();
  const es = lang === "es";
  const message =
    checkInMessage(s, lang, firstName) ||
    (es ? `Hola ${firstName}, ¡hoy es tu día de llegada!` : `Hi ${firstName}, today is your check-in day!`);
  const directions = s.propertyAddress
    ? `\n\n${es ? "Cómo llegar" : "Directions"}: https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.propertyAddress)}`
    : "";
  await sendMail(
    to,
    es ? `Tu llegada hoy a ${name} (${code})` : `Your check-in today at ${name} (${code})`,
    `${message}${directions}\n\n${es ? "También lo tienes en tu viaje" : "It's also on your trip page"}: ${siteUrl()}/account/trips/${code}`,
  );
}

export async function sendAfterStay(to: string, firstName: string, lang: Lang) {
  const s = await getSettings();
  const name = env.propertyName();
  const es = lang === "es";
  const ask = s.reviewLink
    ? es
      ? `Si tienes un minuto, nos ayudaría mucho que dejaras una reseña aquí:\n${s.reviewLink}`
      : `If you have a minute, a review here would help us a lot:\n${s.reviewLink}`
    : es
      ? "Si tienes un minuto, responde a este email y cuéntanos cómo te fue. Nos ayuda mucho."
      : "If you have a minute, reply to this email and tell us how it went. It helps us a lot.";
  await sendMail(
    to,
    es ? `Gracias por quedarte en ${name}` : `Thanks for staying at ${name}`,
    es
      ? `Hola ${firstName},\n\nGracias por elegirnos. Esperamos que lo hayas disfrutado.\n\n${ask}\n\nCuando quieras volver, reserva directo en ${siteUrl()} y ahórrate las comisiones de las plataformas.\n\n${name}`
      : `Hi ${firstName},\n\nThank you for choosing us. We hope you enjoyed it.\n\n${ask}\n\nWhen you want to come back, book direct at ${siteUrl()} and skip the platform fees.\n\n${name}`,
  );
}

export async function sendStillAvailable(to: string, firstName: string, lang: Lang, checkoutPath: string, q: Quote) {
  const name = env.propertyName();
  const es = lang === "es";
  await sendMail(
    to,
    es ? `Tus fechas en ${name} siguen disponibles` : `Your dates at ${name} are still open`,
    es
      ? `Hola ${firstName},\n\nVimos que estabas por reservar del ${q.checkIn} al ${q.checkOut}. Esas fechas siguen libres por ahora.\n\nTermina tu reserva aquí: ${siteUrl()}${checkoutPath}\n\nSi tienes alguna pregunta, responde a este email.\n\n${name}`
      : `Hi ${firstName},\n\nWe noticed you were about to book ${q.checkIn} to ${q.checkOut}. Those dates are still open for now.\n\nFinish your booking here: ${siteUrl()}${checkoutPath}\n\nIf you have any questions, just reply to this email.\n\n${name}`,
  );
}
