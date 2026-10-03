// Shapes shared between the server routes and the browser.

export type PublicDay = {
  date: string;
  available: boolean;
  /** cents, from the pricing rules in /admin */
  price: number;
  minStay: number;
  closedForCheckin: boolean;
  closedForCheckout: boolean;
};

export type TaxLine = { name: string; percent: number };

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
  /** Export (.ics) links from Airbnb, Vrbo, etc. Their busy dates block the site. */
  icalUrls: string[];
  /** Overall rating shown on the site, copied from the platform listing. */
  reviewsAverage: number | null;
  reviewsCount: number | null;
  reviewsPlatform: string;
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
};

export type StayRequest = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  infants: number;
  pets: number;
};

export type Quote = StayRequest & {
  nights: number;
  currency: "USD";
  /** all amounts in cents */
  weekdayNights: number;
  weekendNights: number;
  weekdayRate: number;
  weekendRate: number;
  nightsSubtotal: number;
  lengthDiscount: { label: string; percent: number; amount: number } | null;
  directDiscount: { percent: number; amount: number } | null;
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
  /** full price breakdown saved at booking time (older bookings may lack it) */
  quote?: Quote | null;
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
