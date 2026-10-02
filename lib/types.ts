// Shapes shared between the server routes and the browser.

export type PublicDay = {
  date: string;
  available: boolean;
  /** cents */
  price: number;
  minStay: number;
  closedForCheckin: boolean;
  closedForCheckout: boolean;
};

export type StayRequest = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  infants: number;
};

export type Quote = StayRequest & {
  nights: number;
  currency: "USD";
  /** all amounts in cents */
  accommodation: number;
  cleaningFee: number;
  tax: number;
  taxRatePercent: number;
  total: number;
};

export type GuestDetails = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export type BookResult =
  | { state: "confirmed"; code: string; quote: Quote; firstName: string }
  /** dates were taken while paying; the card hold was released */
  | { state: "released"; message: string }
  /** card declined, no hold */
  | { state: "declined"; message: string }
  /** the total changed since the guest saw it; nothing was charged */
  | { state: "price_changed"; message: string; quote: Quote }
  /** invalid stay or temporary failure; nothing was charged */
  | { state: "error"; message: string };
