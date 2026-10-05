// Photos and amenities shown on the page. Edit freely: the order here is the
// order on the site, and the first photo is the large one.

export type Photo = { src: string; alt: string; altEs: string; w: number; h: number };

const p = (slug: string, alt: string, w: number, h: number, altEs = alt): Photo => ({
  src: `/photos/${slug}`,
  alt,
  altEs,
  w,
  h,
});

export const PHOTOS: Photo[] = [
  p("hot-tub", "Hot tub on the raised deck under the palms, with the canal behind", 1455, 1081, "Spa en la terraza elevada bajo las palmas, con el canal detrás"),
  p("living-room", "Living room with a large sectional, ceiling fan and a big window to the garden", 1091, 1442, "Sala con un sofá seccional grande, ventilador de techo y un ventanal al jardín"),
  p("dock", "Private dock on the canal", 1448, 1086, "Muelle privado en el canal"),
  p("kitchen-island", "Kitchen island with three stools, open to the living room", 1451, 1084, "Isla de cocina con tres banquetas, abierta a la sala"),
  p("game-room", "Game room with air hockey, shuffleboard, an arcade cabinet and a TV", 1446, 1087, "Sala de juegos con air hockey, shuffleboard, máquina arcade y TV"),
  p("primary-bedroom", "Primary bedroom with a king bed and a sitting area", 1453, 1083, "Dormitorio principal con cama king y zona de estar"),
  p("deck", "Deck with lounge chairs and wicker seating next to the hot tub", 1436, 1095, "Terraza con tumbonas y sillones de mimbre junto al spa"),
  p("kitchen", "Full kitchen with stainless appliances and a view to the dining area", 1456, 1080, "Cocina completa con electrodomésticos de acero y vista al comedor"),
  p("primary-bath", "Primary bathroom with a walk-in rain shower and double vanity", 1447, 1087, "Baño principal con ducha de lluvia y doble lavamanos"),
  p("bedroom-2", "Bedroom with a queen bed and rattan nightstands", 1446, 1087, "Dormitorio con cama queen y mesitas de ratán"),
  p("bedroom-3", "Bedroom with a queen bed and a ceiling fan", 1439, 1093, "Dormitorio con cama queen y ventilador de techo"),
  p("dining-garden-doors", "Dining table by the French doors to the deck and canal", 1457, 1080, "Comedor junto a las puertas francesas hacia la terraza y el canal"),
  p("dining", "Dining table with chairs and a bench", 1088, 1445, "Mesa de comedor con sillas y un banco"),
  p("bath-2", "Second bathroom with a tub and shower", 1080, 1456, "Segundo baño con bañera y ducha"),
  p("outdoor-bar", "Outdoor bar seating along the hot tub deck", 1431, 1099, "Barra exterior junto a la terraza del spa"),
  p("patio-grill", "Back patio with a gas grill, picnic table and loungers", 1456, 1080, "Patio trasero con parrilla de gas, mesa de picnic y tumbonas"),
  p("fire-pit", "Fire pit with Adirondack chairs by the water", 1451, 1084, "Fogata con sillas Adirondack junto al agua"),
  p("kayaks", "Kayaks for guests, including a clear-bottom kayak", 1451, 1084, "Kayaks para los huéspedes, incluido uno de fondo transparente"),
  p("laundry", "Washer and dryer in the half bath", 1445, 1088, "Lavadora y secadora en el medio baño"),
  p("aerial", "Aerial view of the house, deck and waterfront", 1432, 1098, "Vista aérea de la casa, la terraza y el frente al agua"),
];

export type AmenityIcon =
  | "water"
  | "hot-tub"
  | "outdoor"
  | "fire"
  | "games"
  | "bed"
  | "kitchen"
  | "laundry"
  | "guests"
  | "pets"
  | "wifi"
  | "ac"
  | "heating"
  | "hot-water"
  | "tv"
  | "fridge"
  | "cooking"
  | "coffee"
  | "clothes"
  | "hair-dryer"
  | "essentials"
  | "furniture"
  | "waterfront"
  | "parking"
  | "smoke-alarm";

// Only list what guests can actually use. Verify each line before publishing.
// The guests and pets lines are added on the page from the /admin settings.
export type Amenity = { icon: AmenityIcon; title: string; titleEs: string; detail?: string; detailEs?: string };

export const AMENITIES: Amenity[] = [
  { icon: "water", title: "On the water", titleEs: "Frente al agua", detail: "Private dock on the canal and kayaks for guests, including a clear-bottom one.", detailEs: "Muelle privado en el canal y kayaks para los huéspedes, incluido uno de fondo transparente." },
  { icon: "hot-tub", title: "Hot tub", titleEs: "Spa", detail: "On a raised deck with canal views, plus bar seating along the side.", detailEs: "En una terraza elevada con vista al canal, con barra para sentarse al lado." },
  { icon: "outdoor", title: "Outdoor living", titleEs: "Vida al aire libre", detail: "Deck loungers, wicker seating, a gas grill and a picnic table.", detailEs: "Tumbonas, sillones de mimbre, parrilla de gas y mesa de picnic." },
  { icon: "fire", title: "Fire pit", titleEs: "Fogata", detail: "Stone fire pit with Adirondack chairs, steps from the water.", detailEs: "Fogata de piedra con sillas Adirondack, a pasos del agua." },
  { icon: "games", title: "Game room", titleEs: "Sala de juegos", detail: "Air hockey, shuffleboard, an arcade cabinet and a TV.", detailEs: "Air hockey, shuffleboard, máquina arcade y TV." },
  { icon: "bed", title: "Bedrooms", titleEs: "Dormitorios", detail: "King primary suite with a sitting area and walk-in shower, plus two queen bedrooms.", detailEs: "Suite principal king con zona de estar y ducha amplia, y dos dormitorios queen." },
  { icon: "kitchen", title: "Kitchen", titleEs: "Cocina", detail: "Full kitchen with island seating, coffee station and a dining table.", detailEs: "Cocina completa con isla, estación de café y mesa de comedor." },
  { icon: "laundry", title: "Laundry", titleEs: "Lavandería", detail: "Washer and dryer inside the house.", detailEs: "Lavadora y secadora dentro de la casa." },
];

// The full list, matching the Airbnb listing. Shown under the highlights.
export const HOUSE_AMENITIES: Amenity[] = [
  { icon: "wifi", title: "Wifi", titleEs: "Wifi" },
  { icon: "ac", title: "Air conditioning", titleEs: "Aire acondicionado" },
  { icon: "heating", title: "Heating", titleEs: "Calefacción" },
  { icon: "hot-water", title: "Hot water", titleEs: "Agua caliente" },
  { icon: "tv", title: "TV", titleEs: "TV" },
  { icon: "waterfront", title: "Waterfront", titleEs: "Frente al agua", detail: "Right on the canal", detailEs: "Justo en el canal" },
  { icon: "hot-tub", title: "Hot tub", titleEs: "Spa" },
  { icon: "furniture", title: "Outdoor furniture", titleEs: "Muebles de exterior" },
  { icon: "parking", title: "Free parking on premises", titleEs: "Estacionamiento gratis en la propiedad" },
  { icon: "kitchen", title: "Kitchen", titleEs: "Cocina", detail: "Refrigerator, oven and stovetop", detailEs: "Refrigerador, horno y estufa" },
  { icon: "fridge", title: "Refrigerator", titleEs: "Refrigerador" },
  { icon: "cooking", title: "Cooking basics", titleEs: "Utensilios de cocina", detail: "Pots and pans, oil, salt and pepper", detailEs: "Ollas y sartenes, aceite, sal y pimienta" },
  { icon: "coffee", title: "Coffee maker", titleEs: "Cafetera" },
  { icon: "laundry", title: "Washer and dryer", titleEs: "Lavadora y secadora" },
  { icon: "clothes", title: "Iron and hangers", titleEs: "Plancha y perchas" },
  { icon: "hair-dryer", title: "Hair dryer", titleEs: "Secador de pelo" },
  { icon: "essentials", title: "Essentials", titleEs: "Artículos básicos", detail: "Towels, bed sheets, soap and toilet paper", detailEs: "Toallas, sábanas, jabón y papel higiénico" },
  { icon: "smoke-alarm", title: "Smoke alarm", titleEs: "Detector de humo" },
];
