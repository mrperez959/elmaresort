// Two languages, kept side by side in the code: l("English", "Español").
// Shared by server and browser.

export type Lang = "en" | "es";

export const LANG_COOKIE = "lang";

export const locale = (lang: Lang) => (lang === "es" ? "es-US" : "en-US");

export type L = (en: string, es: string) => string;

export const makeL =
  (lang: Lang): L =>
  (en, es) =>
    lang === "es" ? es : en;

export function pickLang(cookie: string | undefined, acceptLanguage: string | null): Lang {
  if (cookie === "es" || cookie === "en") return cookie;
  return /^\s*es\b/i.test(acceptLanguage ?? "") ? "es" : "en";
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
export const nightsWord = (lang: Lang, n: number) =>
  lang === "es" ? plural(n, "noche", "noches") : plural(n, "night", "nights");
export const guestsWord = (lang: Lang, n: number) =>
  lang === "es" ? plural(n, "huésped", "huéspedes") : plural(n, "guest", "guests");
export const petsWord = (lang: Lang, n: number) =>
  lang === "es" ? plural(n, "mascota", "mascotas") : plural(n, "pet", "pets");
export const infantsWord = (lang: Lang, n: number) =>
  lang === "es" ? plural(n, "bebé", "bebés") : plural(n, "infant", "infants");

// ---------- Messages that come back from the server in English ----------

const EXACT: Record<string, string> = {
  "Choose a check-in and a check-out date.": "Elige la fecha de llegada y la de salida.",
  "Check-in can't be in the past.": "La llegada no puede ser en el pasado.",
  "Check-out must be after check-in.": "La salida tiene que ser después de la llegada.",
  "At least one adult is required.": "Se necesita al menos un adulto.",
  "Pets aren't allowed.": "No se admiten mascotas.",
  "Those dates aren't open for booking yet.": "Esas fechas todavía no están abiertas para reservar.",
  "Check-in isn't available on that day. Try a different start date.": "No se puede llegar ese día. Prueba otra fecha de llegada.",
  "Check-out isn't available on that day. Try a different end date.": "No se puede salir ese día. Prueba otra fecha de salida.",
  "Some of those nights are already booked.": "Algunas de esas noches ya están reservadas.",
  "Online booking isn't open yet. Please check back soon.": "La reserva en línea todavía no está abierta. Vuelve pronto.",
  "The price couldn't be calculated. Try again.": "No se pudo calcular el precio. Inténtalo de nuevo.",
  "The price couldn't be calculated.": "No se pudo calcular el precio.",
  "Availability couldn't be loaded.": "No se pudo cargar la disponibilidad.",
  "Too many requests. Wait a moment.": "Demasiadas solicitudes. Espera un momento.",
  "That promo code isn't valid.": "Ese código promocional no es válido.",
  "That promo code has expired.": "Ese código promocional ya venció.",
  "That promo code has reached its limit.": "Ese código promocional ya alcanzó su límite.",
  "Enter your first and last name.": "Escribe tu nombre y apellido.",
  "Enter a valid email address.": "Escribe un email válido.",
  "Enter a valid mobile number. Include the country code if it's not a US number (e.g. +44…).":
    "Escribe un celular válido. Incluye el código del país si no es de EE. UU. (por ejemplo +52…).",
  "Use a password of at least 10 characters.": "Usa una contraseña de al menos 10 caracteres.",
  "That password is too long.": "Esa contraseña es demasiado larga.",
  "Don't use your email in your password.": "No uses tu email dentro de la contraseña.",
  "There's already an account with that email. Sign in instead.": "Ya existe una cuenta con ese email. Inicia sesión.",
  "Your account couldn't be created. Try again.": "No se pudo crear tu cuenta. Inténtalo de nuevo.",
  "Too many accounts created from here. Try again later.": "Se crearon demasiadas cuentas desde aquí. Inténtalo más tarde.",
  "Too many attempts. Wait 15 minutes and try again.": "Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.",
  "That email and password don't match.": "El email y la contraseña no coinciden.",
  "Sign-in isn't working right now. Try again.": "El inicio de sesión no está funcionando ahora. Inténtalo de nuevo.",
  "Sign in again to verify your email.": "Inicia sesión otra vez para confirmar tu email.",
  "That code isn't right. Check the email and try again.": "Ese código no es correcto. Revisa el email e inténtalo de nuevo.",
  "That code has expired. Ask for a new one.": "Ese código venció. Pide uno nuevo.",
  "Too many wrong tries. Ask for a new code.": "Demasiados intentos fallidos. Pide un código nuevo.",
  "Please wait a minute before asking for another code.": "Espera un minuto antes de pedir otro código.",
  "Too many codes requested. Try again in an hour.": "Pediste demasiados códigos. Inténtalo en una hora.",
  "The code couldn't be sent. Try again in a minute.": "No se pudo enviar el código. Inténtalo en un minuto.",
  "Your password couldn't be changed. Try again.": "No se pudo cambiar tu contraseña. Inténtalo de nuevo.",
  "Verification isn't working right now. Try again.": "La verificación no está funcionando ahora. Inténtalo de nuevo.",
  "Sign in again.": "Inicia sesión otra vez.",
  "Sign in or create an account to book.": "Inicia sesión o crea una cuenta para reservar.",
  "Confirm your email with the code we sent before booking.": "Confirma tu email con el código que te enviamos antes de reservar.",
  "Too many payment attempts. Please wait an hour or contact us.": "Demasiados intentos de pago. Espera una hora o escríbenos.",
  "Payment details are missing. Try again.": "Faltan los datos del pago. Inténtalo de nuevo.",
  "Please accept the house rules and the rental agreement to book.": "Acepta las reglas de la casa y el contrato de alquiler para reservar.",
  "Something went wrong on our side and your card was not charged. Please try again in a minute.":
    "Algo falló de nuestro lado y no se cobró tu tarjeta. Inténtalo de nuevo en un minuto.",
  "The total for these dates just changed. Review it and pay again.": "El total para estas fechas acaba de cambiar. Revísalo y paga de nuevo.",
  "Those dates were booked by someone else a moment ago. Your card was not charged and the hold was released.":
    "Alguien reservó esas fechas hace un momento. No se cobró tu tarjeta y la retención se liberó.",
  "Your card couldn't be authorized. Try a different card.": "No se pudo autorizar tu tarjeta. Prueba con otra.",
  "Your card was declined. Try a different card or contact your bank.": "Tu tarjeta fue rechazada. Prueba con otra o llama a tu banco.",
  "Your card was declined for insufficient funds.": "Tu tarjeta fue rechazada por fondos insuficientes.",
  "The security code (CVV) doesn't match. Check it and try again.": "El código de seguridad (CVV) no coincide. Revísalo e inténtalo de nuevo.",
  "The ZIP code doesn't match your card. Check it and try again.": "El código postal no coincide con tu tarjeta. Revísalo e inténtalo de nuevo.",
  "The expiration date is invalid. Check it and try again.": "La fecha de vencimiento no es válida. Revísala e inténtalo de nuevo.",
  "This card has expired. Use a different card.": "Esta tarjeta está vencida. Usa otra.",
  "The card number isn't valid. Check it and try again.": "El número de tarjeta no es válido. Revísalo e inténtalo de nuevo.",
  "This card type isn't accepted. Use a different card.": "No aceptamos este tipo de tarjeta. Usa otra.",
  "Your bank needs to verify this payment. Try again and complete the verification.":
    "Tu banco necesita verificar este pago. Inténtalo de nuevo y completa la verificación.",
  "This charge is over your card's limit. Use a different card.": "Este cargo supera el límite de tu tarjeta. Usa otra.",
  "Your card couldn't be charged. Try a different card.": "No se pudo cobrar tu tarjeta. Prueba con otra.",
  "Check your card details and try again.": "Revisa los datos de tu tarjeta e inténtalo de nuevo.",
  "The payment form isn't ready yet.": "El formulario de pago todavía no está listo.",
  "Payment couldn't be completed. Try again.": "No se pudo completar el pago. Inténtalo de nuevo.",
  "Sign in again to manage your trip.": "Inicia sesión otra vez para gestionar tu viaje.",
  "Confirm your email first.": "Primero confirma tu email.",
  "Too many changes in a short time. Try again later.": "Demasiados cambios en poco tiempo. Inténtalo más tarde.",
  "Trip not found.": "No se encontró el viaje.",
  "Something went wrong. Nothing was charged. Try again or contact us.": "Algo falló. No se cobró nada. Inténtalo de nuevo o escríbenos.",
  "This trip can't be changed online anymore. Contact us.": "Este viaje ya no se puede cambiar en línea. Escríbenos.",
  "This trip is already cancelled.": "Este viaje ya está cancelado.",
  "Check-in time has passed. Contact us to make changes to this stay.": "Ya pasó la hora de llegada. Escríbenos para hacer cambios en esta estadía.",
  "The price for this change just changed. Review it and try again.": "El precio de este cambio acaba de cambiar. Revísalo e inténtalo de nuevo.",
  "Enter a card to pay the difference.": "Ingresa una tarjeta para pagar la diferencia.",
  "Those dates were just booked by someone else.": "Alguien acaba de reservar esas fechas.",
  "Part of the refund couldn't be sent. We'll contact you.": "Parte del reembolso no se pudo enviar. Te contactaremos.",
  "Your trip was cancelled, but the refund didn't go through automatically. We'll send it to your card and contact you.":
    "Tu viaje se canceló, pero el reembolso no salió automáticamente. Lo enviaremos a tu tarjeta y te contactaremos.",
  "Your trip was updated, but the refund didn't go through automatically. We'll send it to your card and contact you.":
    "Tu viaje se actualizó, pero el reembolso no salió automáticamente. Lo enviaremos a tu tarjeta y te contactaremos.",
  "Something went wrong.": "Algo falló.",
  "Something went wrong. Try again.": "Algo falló. Inténtalo de nuevo.",
  "Unsupported request.": "Solicitud no válida.",
  "Invalid request.": "Solicitud no válida.",
  "Within 24 hours of booking": "Dentro de las 24 horas de haber reservado",
  "More than 24 hours before check-in": "Más de 24 horas antes de la llegada",
  "Less than 24 hours before check-in": "Menos de 24 horas antes de la llegada",
  "Less than 7 days before check-in": "Menos de 7 días antes de la llegada",
  "The new total is higher. You'll pay the difference now.": "El nuevo total es mayor. Pagas la diferencia ahora.",
  "The total stays the same.": "El total no cambia.",
  "The new total is lower. The difference goes back to your card.": "El nuevo total es menor. La diferencia vuelve a tu tarjeta.",
};

const PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^More than (\d+) days before check-in$/, (m) => `Más de ${m[1]} días antes de la llegada`],
  [/^Less than (\d+) days before check-in$/, (m) => `Menos de ${m[1]} días antes de la llegada`],
  [/^Between (\d+) and 7 days before check-in$/, (m) => `Entre ${m[1]} y 7 días antes de la llegada`],
  [
    /^The new total is lower\. Under the (\w+) cancellation policy, (part of the difference|none of the difference) is refunded\.$/,
    (m) =>
      `El nuevo total es menor. Según la política de cancelación, ${m[2].startsWith("part") ? "se devuelve parte de la diferencia" : "no se devuelve la diferencia"}.`,
  ],
  [/^Stays booked online can be up to (\d+) nights\.$/, (m) => `Las estadías en línea pueden ser de hasta ${m[1]} noches.`],
  [/^The home sleeps up to (\d+) guests\.$/, (m) => `La casa es para un máximo de ${m[1]} huéspedes.`],
  [/^Up to (\d+) pets? (?:is|are) allowed\.$/, (m) => `Se admiten hasta ${m[1]} mascotas.`],
  [/^Stays starting that day need at least (\d+) nights\.$/, (m) => `Las estadías que empiezan ese día requieren al menos ${m[1]} noches.`],
  [/^That code can be used starting (.+)\.$/, (m) => `Ese código se puede usar a partir del ${m[1]}.`],
  [/^That code is for check-ins (.+)\.$/, (m) => `Ese código es para llegadas ${m[1].replace("between", "entre").replace(" and ", " y ").replace("from", "desde").replace("until", "hasta")}.`],
];

/** Spanish version of an English message from the API (unchanged if unknown or lang is "en"). */
export function localizeMessage(lang: Lang, msg: string): string {
  if (lang === "en" || !msg) return msg;
  if (EXACT[msg]) return EXACT[msg];
  for (const [re, fn] of PATTERNS) {
    const m = msg.match(re);
    if (m) return fn(m);
  }
  return msg;
}
