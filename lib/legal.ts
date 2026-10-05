// Legal pages and the rental agreement, in English and Spanish.
// Have a Florida attorney review before relying on them.
import type { Lang } from "./i18n";
import type { Settings } from "./types";
import { POLICIES } from "./policy";
import { money, hourLabel } from "./format";

export const AGREEMENT_VERSION = "2026-10-05";

export type Section = { h: string; p: string[] };

export const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

export function houseRules(s: Settings, lang: Lang): string[] {
  const own = lines(lang === "es" ? s.houseRulesEs : s.houseRules);
  const es = lang === "es";
  return [
    ...own,
    es
      ? `Llegada desde las ${hourLabel(s.checkInHour, lang)}. Salida antes de las ${hourLabel(s.checkOutHour, lang)}.`
      : `Check-in after ${hourLabel(s.checkInHour, lang)}. Check-out by ${hourLabel(s.checkOutHour, lang)}.`,
    es
      ? `Máximo ${s.maxGuests} huéspedes (los bebés no cuentan). Solo pueden alojarse las personas incluidas en la reserva.`
      : `Up to ${s.maxGuests} guests (infants don't count). Only the people included in the booking may stay.`,
    s.maxPets > 0
      ? es
        ? `Hasta ${s.maxPets} mascotas, con una tarifa de ${money(s.petFee)} por estadía, declaradas en la reserva.`
        : `Up to ${s.maxPets} pets, with a ${money(s.petFee)} fee per stay, included in the booking.`
      : es
        ? "No se admiten mascotas."
        : "No pets.",
  ];
}

export function rentalAgreement(s: Settings, lang: Lang, propertyName: string): Section[] {
  const p = POLICIES[s.cancellationPolicy];
  const rules = houseRules(s, lang);
  if (lang === "es") {
    return [
      {
        h: "1. Las partes y la estadía",
        p: [
          `Este contrato es entre la persona que hace la reserva ("el huésped") y el dueño de ${propertyName} ("el anfitrión"). Las fechas, el número de huéspedes y el precio son los que aparecen en la confirmación y el recibo de la reserva.`,
          "Es un alquiler vacacional de corta duración. No crea un contrato de arrendamiento residencial ni derechos de inquilino.",
        ],
      },
      {
        h: "2. Pago, impuestos y cancelación",
        p: [
          "El total, con la tarifa de limpieza, las tarifas opcionales y los impuestos de Florida, se cobra al confirmar la reserva.",
          `Se aplica la política de cancelación ${p.name}: ${p.summary} La política exacta, con sus fechas, aparece en el checkout y en la página del viaje.`,
        ],
      },
      { h: "3. Reglas de la casa", p: ["El huésped acepta cumplir estas reglas y hacer que su grupo las cumpla:", ...rules.map((r) => `• ${r}`)] },
      {
        h: "4. Seguridad",
        p: [
          "La casa está frente al agua y no hay barrera de protección a lo largo del malecón. Los menores de 16 años y las mascotas deben estar supervisados en el patio, el muelle y el spa.",
          "El uso del spa, los kayaks, el muelle y la fogata es bajo la responsabilidad del huésped. Hay chalecos salvavidas disponibles y deben usarse en los kayaks.",
          "No se permiten objetos de vidrio en el área del spa.",
        ],
      },
      {
        h: "5. Daños",
        p: [
          "El huésped responde por los daños a la casa, los muebles y el equipo causados durante su estadía por él, su grupo o sus mascotas, más allá del desgaste normal. El anfitrión enviará una factura detallada con fotos, y el huésped se compromete a pagarla.",
        ],
      },
      {
        h: "6. Incumplimiento",
        p: [
          "Si se incumplen las reglas de forma grave (por ejemplo, más personas de las permitidas, fiestas o fumar dentro), el anfitrión puede terminar la estadía sin reembolso.",
          "El anfitrión puede entrar a la casa con aviso razonable para reparaciones, o sin aviso en una emergencia.",
        ],
      },
      {
        h: "7. Responsabilidad",
        p: [
          "El anfitrión no responde por pérdidas de objetos personales ni por interrupciones de servicios que no dependan de él (electricidad, agua, internet, clima). Si la casa no puede usarse por causas ajenas al huésped, el anfitrión devolverá las noches no disfrutadas.",
        ],
      },
      {
        h: "8. Ley aplicable y aceptación",
        p: [
          "Este contrato se rige por las leyes del estado de Florida.",
          `Al marcar la casilla de aceptación y pagar, el huésped acepta este contrato electrónicamente. Versión ${AGREEMENT_VERSION}.`,
        ],
      },
    ];
  }
  return [
    {
      h: "1. The parties and the stay",
      p: [
        `This agreement is between the person making the booking ("the guest") and the owner of ${propertyName} ("the host"). The dates, number of guests and price are the ones shown in the booking confirmation and receipt.`,
        "This is a short-term vacation rental. It does not create a residential lease or tenancy rights.",
      ],
    },
    {
      h: "2. Payment, taxes and cancellation",
      p: [
        "The total, including the cleaning fee, any optional fees and Florida taxes, is charged when the booking is confirmed.",
        `The ${p.name} cancellation policy applies: ${p.summary} The exact policy, with its dates, is shown at checkout and on the trip page.`,
      ],
    },
    { h: "3. House rules", p: ["The guest agrees to follow these rules and to make sure their group does too:", ...rules.map((r) => `• ${r}`)] },
    {
      h: "4. Safety",
      p: [
        "The home is on the water and there is no protective barrier along the seawall. Children under 16 and pets must be supervised in the backyard, dock and spa areas.",
        "Use of the spa, kayaks, dock and fire pit is at the guest's own risk. Life jackets are provided and must be worn on the kayaks.",
        "No glass in or around the spa.",
      ],
    },
    {
      h: "5. Damage",
      p: [
        "The guest is responsible for damage to the home, furniture and equipment caused during the stay by the guest, their group or their pets, beyond normal wear and tear. The host will send an itemized invoice with photos, and the guest agrees to pay it.",
      ],
    },
    {
      h: "6. Breaking the rules",
      p: [
        "If the rules are seriously broken (for example, more people than allowed, parties, or smoking inside), the host may end the stay without a refund.",
        "The host may enter the home with reasonable notice for repairs, or without notice in an emergency.",
      ],
    },
    {
      h: "7. Liability",
      p: [
        "The host isn't responsible for lost personal belongings or for interruptions of services outside the host's control (power, water, internet, weather). If the home can't be used for reasons that aren't the guest's fault, the host will refund the nights not used.",
      ],
    },
    {
      h: "8. Governing law and acceptance",
      p: [
        "This agreement is governed by the laws of the State of Florida.",
        `By checking the acceptance box and paying, the guest accepts this agreement electronically. Version ${AGREEMENT_VERSION}.`,
      ],
    },
  ];
}

export function privacyPolicy(lang: Lang, propertyName: string, contactEmail: string): Section[] {
  const contact = contactEmail || (lang === "es" ? "el botón de chat del sitio" : "the chat button on this site");
  if (lang === "es") {
    return [
      { h: "Qué datos guardamos", p: [
        "Tu nombre, email, teléfono y contraseña (cifrada) cuando creas una cuenta.",
        "Tus reservas: fechas, huéspedes, precio, la aceptación de las reglas y del contrato (con fecha, hora y la dirección IP de ese momento).",
        "Estadísticas de uso del sitio: páginas vistas, tiempo y la región aproximada de tu conexión. No guardamos direcciones IP para estadísticas ni usamos cookies de publicidad.",
      ] },
      { h: "Pagos", p: ["Los datos de tu tarjeta los procesa Square y nunca pasan por nuestros servidores ni los guardamos."] },
      { h: "Con quién los compartimos", p: [
        "Con Square (pagos), nuestro proveedor de email (para enviarte códigos y confirmaciones) y nuestro sistema de gestión de reservas, que recibe tu nombre, contacto y fechas para organizar tu estadía. No vendemos tus datos.",
      ] },
      { h: "Cookies", p: ["Usamos solo las cookies necesarias para mantener tu sesión y tu idioma, y un identificador anónimo en tu navegador para las estadísticas."] },
      { h: "Cuánto tiempo", p: ["Las estadísticas se borran después de unos 13 meses. Los datos de reservas se guardan el tiempo que exige la ley fiscal."] },
      { h: "Tus derechos", p: [`Puedes pedirnos una copia de tus datos o que borremos tu cuenta escribiendo a ${contact}.`] },
      { h: "Quiénes somos", p: [`${propertyName}, alquiler vacacional en Tampa, Florida.`] },
    ];
  }
  return [
    { h: "What we collect", p: [
      "Your name, email, phone and password (encrypted) when you create an account.",
      "Your bookings: dates, guests, price, and your acceptance of the house rules and rental agreement (with the date, time and IP address at that moment).",
      "Site usage statistics: pages viewed, time on site and the approximate region of your connection. We don't store IP addresses for statistics or use advertising cookies.",
    ] },
    { h: "Payments", p: ["Your card details are processed by Square and never pass through or stay on our servers."] },
    { h: "Who we share it with", p: [
      "Square (payments), our email provider (to send you codes and confirmations) and our booking management system, which receives your name, contact details and dates to organize your stay. We don't sell your data.",
    ] },
    { h: "Cookies", p: ["We only use the cookies needed to keep you signed in and remember your language, plus an anonymous ID in your browser for statistics."] },
    { h: "How long", p: ["Statistics are deleted after about 13 months. Booking records are kept as long as tax law requires."] },
    { h: "Your rights", p: [`You can ask for a copy of your data or for your account to be deleted by writing to ${contact}.`] },
    { h: "Who we are", p: [`${propertyName}, a vacation rental in Tampa, Florida.`] },
  ];
}

/** The owner's check-in message with {first_name} and {address} filled in. Spanish falls back to English. */
export function checkInMessage(s: Settings, lang: Lang, firstName: string): string {
  const template = (lang === "es" && s.checkInInstructionsEs) || s.checkInInstructions;
  return template.replaceAll("{first_name}", firstName).replaceAll("{address}", s.propertyAddress);
}
