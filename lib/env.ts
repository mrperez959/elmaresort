import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing environment variable ${name}. See .env.example.`);
  }
  return value.trim();
}

function number(name: string): number {
  const raw = required(name);
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Environment variable ${name} must be a non-negative number (got "${raw}").`);
  }
  return n;
}

export const env = {
  hospitableToken: () => required("HOSPITABLE_API_PAT"),
  propertyId: () => required("HOSPITABLE_PROPERTY_ID"),
  squareAccessToken: () => required("SQUARE_ACCESS_TOKEN"),
  squareLocationId: () => required("NEXT_PUBLIC_SQUARE_LOCATION_ID"),
  squareProduction: () => required("NEXT_PUBLIC_SQUARE_ENVIRONMENT") === "production",
  cleaningFeeCents: () => Math.round(number("CLEANING_FEE_USD") * 100),
  taxRatePercent: () => number("TAX_RATE_PERCENT"),
  maxGuests: () => number("MAX_GUESTS"),
  maxNights: () => number("MAX_NIGHTS"),
  propertyName: () => process.env.NEXT_PUBLIC_PROPERTY_NAME ?? "Vacation rental",
};
