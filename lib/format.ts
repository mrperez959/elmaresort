// Browser-safe formatting helpers.
import { locale, type Lang } from "./i18n";

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

export function longDate(iso: string, lang: Lang = "en") {
  return new Intl.DateTimeFormat(locale(lang), {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(asDate(iso));
}

export function a11yDate(iso: string, lang: Lang = "en") {
  return new Intl.DateTimeFormat(locale(lang), {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(asDate(iso));
}

export function monthLabel(year: number, month: number, lang: Lang = "en") {
  const s = new Intl.DateTimeFormat(locale(lang), { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month, 15)),
  );
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const hourLabel = (h: number, lang: Lang = "en") =>
  new Intl.DateTimeFormat(locale(lang), { hour: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 1, h)));
