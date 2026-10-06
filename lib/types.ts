// Shapes shared between the server routes and the browser.

export type PublicDay = {
  date: string;
  available: boolean;
  /** cents, from the pricing rules in /admin */
  price: number;
  /** price before a last-minute or gap discount, to show it crossed out */
  regular?: number;
  minStay: number;
  closedForCheckin: boolean;
  closedForCheckout: boolean;
};

export type TaxLine = { name: string; percent: number };

/** A date range priced up or down, e.g. Gasparilla +35%. `end` is the check-out day (exclusive). */
export type SpecialDates = { start: string; end: string; label: string; percent: number };

/** Automatic pricing that follows the season and fills empty nights. Money in cents. */
export type SmartPricing = {
  enabled: boolean;
  /** 12 entries, January first: price of a weeknight and of a weekend night */
  months: Array<{ weekday: number; weekend: number }>;
  specials: SpecialDates[];
  /** e.g. [{ days: 3, percent: 15 }]: nights still free within 3 days get 15% off */
  lastMinute: Array<{ days: number; percent: number }>;
  /** Short free gaps between bookings: discount, and allow booking exactly the gap */
  gapFill: { enabled: boolean; maxNights: number; percent: number };
  /** When the 2 weeks around a night are already mostly booked, raise it */
  demand: { enabled: boolean; threshold: number; percent: number };
  minPrice: number;
  maxPrice: number;
};

/** All pricing and policy rules. Money in cents. */
export type Settings = {
  baseNightly: number;
  weekendMarkupPercent: number;
  /** Day of week (0 = Sunday) of the nights that get the weekend rate */
  weekendNights: number[];
  cleaningFee: number;
  /** Per stay, not per pet */
  petFee: number;
  maxPets: number;
  /** Adults + children. Infants don't count. */
  maxGuests: number;
  weeklyDiscountPercent: number;
  weeklyMinNights: number;
  monthlyDiscountPercent: number;
  monthlyMinNights: number;
  directDiscountEnabled: boolean;
  directDiscountPercent: number;
  /**
   * Government taxes, each its own line on the invoice (e.g. Florida sales tax,
   * county surtax, tourist development tax). null = not configured yet:
   * online booking stays closed. [] = deliberately no taxes.
   */
  taxes: TaxLine[] | null;
  maxNights: number;
  minNights: number;
  smartPricing: SmartPricing;
  /** Export (.ics) links from Airbnb, Vrbo, etc. Their busy dates block the site. */
  icalUrls: string[];
  /** Overall rating shown on the site, copied from the platform listing. */
  reviewsAverage: number | null;
  reviewsCount: number | null;
  reviewsPlatform: string;
  cancellationPolicy: "flexible" | "moderate" | "limited" | "firm";
  /** local hour (0-23) */
  checkInHour: number;
  checkOutHour: number;
  /** Chat button. Empty = hidden. WhatsApp/phone in international format, e.g. +18135550100 */
  contactWhatsApp: string;
  contactPhone: string;
  contactEmail: string;
  /** PRIVATE: shown only to the guest, on their trip page, from check-in day */
  propertyAddress: string;
  /**
   * PRIVATE: the check-in day message (door code, wifi...). Same visibility as the
   * address. Placeholders: {first_name} {address}. Emailed on check-in morning.
   */
  checkInInstructions: string;
  checkInInstructionsEs: string;
  /** One rule per line, shown on /house-rules and accepted at checkout */
  houseRules: string;
  houseRulesEs: string;
  /** Optional link where guests can leave a review (e.g. Google), used in the after-stay email */
  reviewLink: string;
  /** Public, approximate: area name shown next to the map */
  approxArea: string;
  /** Public, approximate: "lat, lng" of a point NEAR the house (not the house). "" = center on approxArea */
  mapCenter: string;
  mapZoom: number;
};

export type PublicSettings = {
  maxGuests: number;
  maxPets: number;
  petFee: number;
  directDiscountEnabled: boolean;
  directDiscountPercent: number;
  weeklyDiscountPercent: number;
  weeklyMinNights: number;
  monthlyDiscountPercent: number;
  monthlyMinNights: number;
  bookingOpen: boolean;
  cancellationPolicy: Settings["cancellationPolicy"];
  checkInHour: number;
  checkOutHour: number;
};

export type StayRequest = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  infants: number;
  pets: number;
  /** promo code typed by the guest */
  promo?: string;
};

/** A promo code as applied to one stay (frozen into the booking). */
export type AppliedPromo = { code: string; percent: number; commissionPercent: number };

export type Quote = StayRequest & {
  nights: number;
  currency: "USD";
  /** all amounts in cents */
  weekdayNights: number;
  weekendNights: number;
  weekdayRate: number;
  weekendRate: number;
  nightsSubtotal: number;
  /** price of each night (smart pricing) */
  nightly?: Array<{ date: string; price: number }>;
  lengthDiscount: { label: string; percent: number; amount: number } | null;
  directDiscount: { percent: number; amount: number } | null;
  promoDiscount: (AppliedPromo & { amount: number }) | null;
  /** nights after discounts */
  accommodation: number;
  cleaningFee: number;
  petFee: number;
  /** nights after discounts + cleaning + pet fee: the price before government taxes */
  subtotal: number;
  taxes: Array<TaxLine & { amount: number }>;
  /** sum of all tax lines */
  tax: number;
  /** what the guest pays */
  total: number;
};

export type PublicUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  emailVerified: boolean;
  lang: "en" | "es";
};

export type BookingSummary = {
  code: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  pets: number;
  total: number;
  status: string;
  createdAt: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  /** full price breakdown saved at booking time (older bookings may lack it) */
  quote?: Quote | null;
  refunded?: number;
};

export type BookResult =
  | { state: "confirmed"; code: string; quote: Quote; firstName: string }
  /** dates were taken while paying; the card hold was released */
  | { state: "released"; message: string }
  /** card declined, no hold */
  | { state: "declined"; message: string }
  /** the total changed since the guest saw it; nothing was charged */
  | { state: "price_changed"; message: string; quote: Quote }
  /** not signed in */
  | { state: "signin_required"; message: string }
  /** invalid stay or temporary failure; nothing was charged */
  | { state: "error"; message: string };
