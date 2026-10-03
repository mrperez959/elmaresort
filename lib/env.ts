import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing environment variable ${name}. See .env.example.`);
  }
  return value.trim();
}

// Prices, fees, discounts and limits live in the database (edited at /admin).
export const env = {
  squareAccessToken: () => required("SQUARE_ACCESS_TOKEN"),
  squareLocationId: () => required("NEXT_PUBLIC_SQUARE_LOCATION_ID"),
  squareProduction: () => required("NEXT_PUBLIC_SQUARE_ENVIRONMENT") === "production",
  propertyName: () => process.env.NEXT_PUBLIC_PROPERTY_NAME ?? "Vacation rental",
};
