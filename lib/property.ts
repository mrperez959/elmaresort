// Photos and amenities shown on the page. Edit freely: the order here is the
// order on the site, and the first photo is the large one.

export type Photo = { src: string; alt: string; w: number; h: number };

const p = (slug: string, alt: string, w: number, h: number): Photo => ({
  src: `/photos/${slug}`,
  alt,
  w,
  h,
});

export const PHOTOS: Photo[] = [
  p("hot-tub", "Hot tub on the raised deck under the palms, with the canal behind", 1455, 1081),
  p("living-room", "Living room with a large sectional, ceiling fan and a big window to the garden", 1091, 1442),
  p("dock", "Private dock on the canal", 1448, 1086),
  p("kitchen-island", "Kitchen island with three stools, open to the living room", 1451, 1084),
  p("game-room", "Game room with air hockey, shuffleboard, an arcade cabinet and a TV", 1446, 1087),
  p("primary-bedroom", "Primary bedroom with a king bed and a sitting area", 1453, 1083),
  p("deck", "Deck with lounge chairs and wicker seating next to the hot tub", 1436, 1095),
  p("kitchen", "Full kitchen with stainless appliances and a view to the dining area", 1456, 1080),
  p("primary-bath", "Primary bathroom with a walk-in rain shower and double vanity", 1447, 1087),
  p("bedroom-2", "Bedroom with a queen bed and rattan nightstands", 1446, 1087),
  p("bedroom-3", "Bedroom with a queen bed and a ceiling fan", 1439, 1093),
  p("dining-garden-doors", "Dining table by the French doors to the deck and canal", 1457, 1080),
  p("dining", "Dining table with chairs and a bench", 1088, 1445),
  p("bath-2", "Second bathroom with a tub and shower", 1080, 1456),
  p("outdoor-bar", "Outdoor bar seating along the hot tub deck", 1431, 1099),
  p("patio-grill", "Back patio with a gas grill, picnic table and loungers", 1456, 1080),
  p("fire-pit", "Fire pit with Adirondack chairs by the water", 1451, 1084),
  p("kayaks", "Kayaks for guests, including a clear-bottom kayak", 1451, 1084),
  p("laundry", "Washer and dryer in the half bath", 1445, 1088),
  p("aerial", "Aerial view of the house, deck and waterfront", 1432, 1098),
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
export const AMENITIES: Array<{ icon: AmenityIcon; title: string; detail: string }> = [
  { icon: "water", title: "On the water", detail: "Private dock on the canal and kayaks for guests, including a clear-bottom one." },
  { icon: "hot-tub", title: "Hot tub", detail: "On a raised deck with canal views, plus bar seating along the side." },
  { icon: "outdoor", title: "Outdoor living", detail: "Deck loungers, wicker seating, a gas grill and a picnic table." },
  { icon: "fire", title: "Fire pit", detail: "Stone fire pit with Adirondack chairs, steps from the water." },
  { icon: "games", title: "Game room", detail: "Air hockey, shuffleboard, an arcade cabinet and a TV." },
  { icon: "bed", title: "Bedrooms", detail: "King primary suite with a sitting area and walk-in shower, plus two queen bedrooms." },
  { icon: "kitchen", title: "Kitchen", detail: "Full kitchen with island seating, coffee station and a dining table." },
  { icon: "laundry", title: "Laundry", detail: "Washer and dryer inside the house." },
];

// The full list, matching the Airbnb listing. Shown under the highlights.
export const HOUSE_AMENITIES: Array<{ icon: AmenityIcon; title: string; detail?: string }> = [
  { icon: "wifi", title: "Wifi" },
  { icon: "ac", title: "Air conditioning" },
  { icon: "heating", title: "Heating" },
  { icon: "hot-water", title: "Hot water" },
  { icon: "tv", title: "TV" },
  { icon: "waterfront", title: "Waterfront", detail: "Right on the canal" },
  { icon: "hot-tub", title: "Hot tub" },
  { icon: "furniture", title: "Outdoor furniture" },
  { icon: "parking", title: "Free parking on premises" },
  { icon: "kitchen", title: "Kitchen", detail: "Refrigerator, oven and stovetop" },
  { icon: "fridge", title: "Refrigerator" },
  { icon: "cooking", title: "Cooking basics", detail: "Pots and pans, oil, salt and pepper" },
  { icon: "coffee", title: "Coffee maker" },
  { icon: "laundry", title: "Washer and dryer" },
  { icon: "clothes", title: "Iron and hangers" },
  { icon: "hair-dryer", title: "Hair dryer" },
  { icon: "essentials", title: "Essentials", detail: "Towels, bed sheets, soap and toilet paper" },
  { icon: "smoke-alarm", title: "Smoke alarm" },
];
