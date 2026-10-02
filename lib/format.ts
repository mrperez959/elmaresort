// Browser-safe formatting helpers.

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const money = (cents: number) => usd.format(cents / 100);
export const moneyShort = (cents: number) => usdWhole.format(Math.round(cents / 100));

function asDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`);
}

export function longDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(asDate(iso));
}

export function a11yDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(asDate(iso));
}

export function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month, 15)));
}
