// Text that describes the home, for guests, Google and AI assistants.
// Edit freely. Drive times are approximate, without traffic: check them.
import type { Lang } from "./i18n";
import type { Settings } from "./types";
import { money, hourLabel } from "./format";
import { policySummary } from "./policy";

export function aboutHome(lang: Lang, s: Settings): string[] {
  if (lang === "es") {
    return [
      `Elma Resort es una casa remodelada frente a un canal en Tampa, Florida, para hasta ${s.maxGuests} huéspedes. Tiene muelle privado, kayaks, spa en una terraza elevada con vista al agua, fogata y una sala de juegos con air hockey, shuffleboard y máquina arcade.`,
      "Adentro hay una suite principal con cama king y baño con ducha amplia, dos dormitorios con cama queen, cocina completa con isla, comedor y lavadora y secadora. La entrada es con código, así que llegas a tu hora sin esperar a nadie.",
      `Está a pocos minutos del aeropuerto de Tampa y a una media hora de las playas de Clearwater.${s.maxPets > 0 ? " Se admiten mascotas." : ""}`,
    ];
  }
  return [
    `Elma Resort is a remodeled waterfront home on a canal in Tampa, Florida, for up to ${s.maxGuests} guests. It has a private dock, kayaks, a hot tub on a raised deck with water views, a fire pit and a game room with air hockey, shuffleboard and an arcade cabinet.`,
    "Inside there's a king primary suite with a walk-in shower, two queen bedrooms, a full kitchen with island seating, a dining area and a washer and dryer. Check-in is self check-in with a door code, so you arrive on your own schedule.",
    `It's a few minutes from Tampa International Airport and about half an hour from the beaches of Clearwater.${s.maxPets > 0 ? " Pets are welcome." : ""}`,
  ];
}

/** Approximate drive times from the house. */
export const NEARBY: Array<{ en: string; es: string; minutes: number }> = [
  { en: "Tampa International Airport", es: "Aeropuerto Internacional de Tampa", minutes: 15 },
  { en: "Raymond James Stadium", es: "Estadio Raymond James", minutes: 15 },
  { en: "International Plaza shopping", es: "Centro comercial International Plaza", minutes: 15 },
  { en: "Downtown Tampa", es: "Centro de Tampa", minutes: 20 },
  { en: "Clearwater Beach", es: "Playa de Clearwater", minutes: 30 },
  { en: "Busch Gardens", es: "Busch Gardens", minutes: 30 },
];

export type Faq = { q: string; a: string };

export function faqs(lang: Lang, s: Settings): Faq[] {
  const es = lang === "es";
  const pets =
    s.maxPets > 0
      ? es
        ? `Sí. Se admiten hasta ${s.maxPets} mascotas, con una tarifa de ${money(s.petFee)} por estadía. Inclúyelas al reservar y supervísalas en el patio, el muelle y el spa.`
        : `Yes. Up to ${s.maxPets} pets are welcome, with a ${money(s.petFee)} fee per stay. Add them when you book, and keep an eye on them around the backyard, dock and hot tub.`
      : es
        ? "No se admiten mascotas."
        : "Pets aren't allowed.";
  const direct =
    s.directDiscountEnabled && s.directDiscountPercent > 0
      ? es
        ? ` Además, reservando aquí tienes un ${s.directDiscountPercent}% de descuento sobre las noches.`
        : ` Booking here also gives you ${s.directDiscountPercent}% off the nights.`
      : "";
  if (es) {
    return [
      { q: "¿Cuántas personas caben?", a: `Hasta ${s.maxGuests} huéspedes, sin contar bebés. Hay una cama king y dos camas queen.` },
      { q: "¿Se admiten mascotas?", a: pets },
      { q: "¿A qué hora es la llegada y la salida?", a: `La llegada es desde las ${hourLabel(s.checkInHour, lang)} y la salida antes de las ${hourLabel(s.checkOutHour, lang)}. La entrada es con código; el día de llegada te enviamos la dirección y las instrucciones.` },
      { q: "¿Hay estacionamiento?", a: "Sí, estacionamiento gratis dentro de la propiedad." },
      { q: "¿Se pueden usar los kayaks y el muelle?", a: "Sí. Hay kayaks para los huéspedes, incluido uno de fondo transparente, y chalecos salvavidas. Se usan bajo tu propia responsabilidad. No hay barrera a lo largo del malecón, así que los niños deben estar supervisados." },
      { q: "¿El spa tiene calefacción?", a: "Sí. Por favor tápalo cuando no lo uses y no lleves vasos de vidrio al área del spa." },
      { q: "¿Está cerca de la playa?", a: "La casa está en un canal, no en la playa. Las playas de Clearwater están a unos 30 minutos en auto." },
      { q: "¿Se puede fumar?", a: "No se permite fumar dentro de la casa." },
      { q: "¿Cuál es la política de cancelación?", a: policySummary(s.cancellationPolicy, lang) },
      { q: "¿Por qué reservar aquí y no en Airbnb?", a: `Es la misma casa y el mismo anfitrión, sin la comisión de servicio de las plataformas.${direct} Tu reserva, recibo y cambios quedan en tu cuenta.` },
    ];
  }
  return [
    { q: "How many people does the home sleep?", a: `Up to ${s.maxGuests} guests, not counting infants. There's one king bed and two queen beds.` },
    { q: "Are pets allowed?", a: pets },
    { q: "What are the check-in and check-out times?", a: `Check-in is after ${hourLabel(s.checkInHour, lang)} and check-out is by ${hourLabel(s.checkOutHour, lang)}. It's self check-in with a door code; on your arrival day we email you the address and instructions.` },
    { q: "Is there parking?", a: "Yes, free parking on the property." },
    { q: "Can we use the kayaks and the dock?", a: "Yes. There are kayaks for guests, including a clear-bottom one, and life jackets. Use them at your own risk. There's no barrier along the seawall, so children must be supervised." },
    { q: "Is the hot tub heated?", a: "Yes. Please keep the lid on when you're not using it, and no glass around the hot tub." },
    { q: "Is it close to the beach?", a: "The home is on a canal, not on the beach. The beaches of Clearwater are about 30 minutes by car." },
    { q: "Can we smoke?", a: "No smoking inside the house." },
    { q: "What's the cancellation policy?", a: policySummary(s.cancellationPolicy, lang) },
    { q: "Why book here instead of Airbnb?", a: `It's the same home and the same host, without the platforms' service fee.${direct} Your booking, receipt and changes are all in your account.` },
  ];
}
