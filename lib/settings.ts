import "server-only";
import { query } from "./db";
import type { PublicSettings, Settings } from "./types";
import { isPolicyId } from "./policy";
import { DEFAULT_SMART } from "./smart-pricing";
import type { SmartPricing } from "./types";

/** Starting values. Everything here can be changed from /admin. */
export const DEFAULT_SETTINGS: Settings = {
  baseNightly: 30000,
  weekendMarkupPercent: 37,
  weekendNights: [5, 6], // nights of Friday and Saturday
  cleaningFee: 17500,
  petFee: 2000,
  maxPets: 2,
  maxGuests: 10,
  weeklyDiscountPercent: 10,
  weeklyMinNights: 7,
  monthlyDiscountPercent: 18,
  monthlyMinNights: 28,
  directDiscountEnabled: true,
  directDiscountPercent: 5,
  taxes: null, // must be set in /admin before online booking opens
  maxNights: 90,
  minNights: 2,
  icalUrls: [],
  reviewsAverage: null,
  reviewsCount: null,
  reviewsPlatform: "Airbnb",
  cancellationPolicy: "moderate",
  checkInHour: 16,
  checkOutHour: 11,
  contactWhatsApp: "",
  contactPhone: "",
  contactEmail: "",
  propertyAddress: "",
  checkInInstructions: "",
  checkInInstructionsEs: "",
  houseRules: "No smoking inside the house.",
  houseRulesEs: "No se permite fumar dentro de la casa.",
  reviewLink: "",
  approxArea: "Town 'n' Country, Tampa, FL",
  mapCenter: "",
  mapZoom: 15,
  smartPricing: DEFAULT_SMART,
};

export class SettingsError extends Error {}

// Short cache. Kept on globalThis so every route in this server instance
// shares it (Next bundles pages and API routes separately). Other instances
// pick up changes within CACHE_MS.
const CACHE_MS = 15_000;
const store = globalThis as unknown as { __elmaSettings?: { at: number; value: Settings } };

export async function getSettings(): Promise<Settings> {
  const hit = store.__elmaSettings;
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const rows = await query<{ data: Partial<Settings> & { taxRatePercent?: number | null } }>(
    "SELECT data FROM settings WHERE id = 1",
  );
  const stored = rows[0]?.data ?? {};
  const { taxRatePercent: legacyTax, ...rest } = stored;
  const value: Settings = { ...DEFAULT_SETTINGS, ...rest };
  // Older versions stored one combined rate.
  if (stored.taxes === undefined && typeof legacyTax === "number") {
    value.taxes = [{ name: "Taxes", percent: legacyTax }];
  }
  store.__elmaSettings = { at: Date.now(), value };
  return value;
}

function int(input: Record<string, unknown>, key: keyof Settings, min: number, max: number): number {
  const n = Number(input[key]);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new SettingsError(`${String(key)} must be a number between ${min} and ${max}.`);
  }
  return Math.round(n);
}

function percent(input: Record<string, unknown>, key: keyof Settings, max = 100): number {
  const n = Number(input[key]);
  if (!Number.isFinite(n) || n < 0 || n > max) {
    throw new SettingsError(`${String(key)} must be between 0 and ${max}.`);
  }
  return Math.round(n * 100) / 100;
}

function phone(v: unknown, label: string): string {
  const raw = String(v ?? "").trim();
  if (!raw) return "";
  const digits = raw.replace(/[^\d+]/g, "");
  if (!/^\+?\d{10,15}$/.test(digits)) throw new SettingsError(`${label}: use the full number with country code, e.g. +1 813 555 0100.`);
  return digits.startsWith("+") ? digits : `+${digits.length === 10 ? "1" + digits : digits}`;
}

/** "28.01, -82.57" style coordinates, as copied from Google Maps. */
function latLng(v: unknown): string {
  const raw = String(v ?? "").trim();
  if (!raw) return "";
  const m = /^\(?\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*\)?$/.exec(raw);
  const lat = m ? Number(m[1]) : NaN;
  const lng = m ? Number(m[2]) : NaN;
  if (!m || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new SettingsError("Map center: paste coordinates like 28.0123, -82.5678 (right-click the map in Google Maps).");
  }
  // Kept as the owner entered it (up to 6 decimals): the owner picks the point to show.
  return `${Number(lat.toFixed(6))}, ${Number(lng.toFixed(6))}`;
}

function url(v: unknown): string {
  const raw = String(v ?? "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") throw new Error();
    return u.toString().slice(0, 500);
  } catch {
    throw new SettingsError("Review link must be a full https:// link.");
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function cents(v: unknown, label: string, min = 50, max = 5000): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min * 100 || n > max * 100) {
    throw new SettingsError(`${label} must be between $${min} and $${max}.`);
  }
  return Math.round(n);
}

function validateSmart(raw: unknown): SmartPricing {
  if (!raw || typeof raw !== "object") return DEFAULT_SMART;
  const r = raw as Record<string, unknown>;
  const months = Array.isArray(r.months) ? r.months : [];
  if (months.length !== 12) throw new SettingsError("Smart pricing needs a price for each of the 12 months.");
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const specials = Array.isArray(r.specials) ? r.specials : [];
  if (specials.length > 60) throw new SettingsError("Use at most 60 special dates.");
  const tiers = Array.isArray(r.lastMinute) ? r.lastMinute : [];
  if (tiers.length > 5) throw new SettingsError("Use at most 5 last-minute steps.");
  const gap = (r.gapFill ?? {}) as Record<string, unknown>;
  const demand = (r.demand ?? {}) as Record<string, unknown>;
  const out: SmartPricing = {
    enabled: Boolean(r.enabled),
    months: months.map((mo, i) => {
      const x = (mo ?? {}) as Record<string, unknown>;
      return {
        weekday: cents(x.weekday, `${names[i]} weeknight`),
        weekend: cents(x.weekend, `${names[i]} weekend night`),
      };
    }),
    specials: specials.map((sp) => {
      const x = (sp ?? {}) as Record<string, unknown>;
      const start = String(x.start ?? "");
      const end = String(x.end ?? "");
      const label = String(x.label ?? "").trim().slice(0, 60);
      const percent = Number(x.percent);
      if (!ISO.test(start) || !ISO.test(end) || end <= start) {
        throw new SettingsError(`Special date "${label || start}": the end must be after the start.`);
      }
      if (!Number.isFinite(percent) || percent < -50 || percent > 200) {
        throw new SettingsError(`Special date "${label || start}": use a change between -50% and +200%.`);
      }
      return { start, end, label: label || "Special", percent: Math.round(percent) };
    }),
    lastMinute: tiers
      .map((t) => {
        const x = (t ?? {}) as Record<string, unknown>;
        const days = Math.round(Number(x.days));
        const percent = Math.round(Number(x.percent));
        if (!(days >= 0 && days <= 60) || !(percent >= 0 && percent <= 60)) {
          throw new SettingsError("Last-minute steps: 0 to 60 days and 0 to 60%.");
        }
        return { days, percent };
      })
      .sort((a, b) => a.days - b.days),
    gapFill: {
      enabled: Boolean(gap.enabled),
      maxNights: Math.min(6, Math.max(1, Math.round(Number(gap.maxNights) || 3))),
      percent: Math.min(60, Math.max(0, Math.round(Number(gap.percent) || 0))),
    },
    demand: {
      enabled: Boolean(demand.enabled),
      threshold: Math.min(100, Math.max(30, Math.round(Number(demand.threshold) || 70))),
      percent: Math.min(60, Math.max(0, Math.round(Number(demand.percent) || 0))),
    },
    minPrice: cents(r.minPrice, "Lowest nightly price"),
    maxPrice: cents(r.maxPrice, "Highest nightly price"),
  };
  if (out.minPrice > out.maxPrice) throw new SettingsError("The lowest price can't be above the highest price.");
  return out;
}

function email(v: unknown): string {
  const raw = String(v ?? "").trim();
  if (!raw) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) throw new SettingsError("Contact email isn't valid.");
  return raw.slice(0, 200);
}

/** Validate untrusted admin input. Money is in cents. */
export function validateSettings(raw: unknown): Settings {
  const input = (raw ?? {}) as Record<string, unknown>;
  const weekendNights = Array.isArray(input.weekendNights)
    ? [...new Set(input.weekendNights.map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort()
    : DEFAULT_SETTINGS.weekendNights;

  let taxes: Settings["taxes"] = null;
  if (Array.isArray(input.taxes)) {
    if (input.taxes.length > 6) throw new SettingsError("Use at most 6 tax lines.");
    taxes = input.taxes.map((t) => {
      const line = (t ?? {}) as Record<string, unknown>;
      const name = String(line.name ?? "").trim().slice(0, 60);
      const n = Number(line.percent);
      if (!name) throw new SettingsError("Every tax line needs a name, e.g. Florida sales tax.");
      if (line.percent === "" || !Number.isFinite(n) || n < 0 || n > 30) {
        throw new SettingsError(`Enter a percentage between 0 and 30 for "${name}".`);
      }
      return { name, percent: Math.round(n * 1000) / 1000 };
    });
  }

  const icalUrls = (Array.isArray(input.icalUrls) ? input.icalUrls : String(input.icalUrls ?? "").split(/\s+/))
    .map((u) => String(u).trim())
    .filter(Boolean);
  if (icalUrls.length > 6) throw new SettingsError("Use at most 6 calendar links.");
  for (const u of icalUrls) {
    let url: URL;
    try {
      url = new URL(u);
    } catch {
      throw new SettingsError(`This calendar link isn't a valid URL: ${u.slice(0, 80)}`);
    }
    if (url.protocol !== "https:") throw new SettingsError("Calendar links must start with https://");
  }

  const avgRaw = input.reviewsAverage;
  const reviewsAverage =
    avgRaw === null || avgRaw === "" || avgRaw === undefined
      ? null
      : (() => {
          const n = Number(avgRaw);
          if (!Number.isFinite(n) || n < 1 || n > 5) throw new SettingsError("The rating must be between 1 and 5.");
          return Math.round(n * 100) / 100;
        })();
  const countRaw = input.reviewsCount;
  const reviewsCount =
    countRaw === null || countRaw === "" || countRaw === undefined ? null : int(input, "reviewsCount", 1, 100_000);

  const s: Settings = {
    baseNightly: int(input, "baseNightly", 1000, 10_000_00),
    weekendMarkupPercent: percent(input, "weekendMarkupPercent", 300),
    weekendNights,
    cleaningFee: int(input, "cleaningFee", 0, 2_000_00),
    petFee: int(input, "petFee", 0, 1_000_00),
    maxPets: int(input, "maxPets", 0, 10),
    maxGuests: int(input, "maxGuests", 1, 50),
    weeklyDiscountPercent: percent(input, "weeklyDiscountPercent", 90),
    weeklyMinNights: int(input, "weeklyMinNights", 2, 60),
    monthlyDiscountPercent: percent(input, "monthlyDiscountPercent", 90),
    monthlyMinNights: int(input, "monthlyMinNights", 2, 120),
    directDiscountEnabled: Boolean(input.directDiscountEnabled),
    directDiscountPercent: percent(input, "directDiscountPercent", 50),
    taxes,
    maxNights: int(input, "maxNights", 1, 365),
    minNights: int(input, "minNights", 1, 30),
    icalUrls: [...new Set(icalUrls)],
    reviewsAverage,
    reviewsCount,
    reviewsPlatform: String(input.reviewsPlatform ?? "Airbnb").trim().slice(0, 40) || "Airbnb",
    cancellationPolicy: isPolicyId(input.cancellationPolicy) ? input.cancellationPolicy : "moderate",
    checkInHour: int(input, "checkInHour", 0, 23),
    checkOutHour: int(input, "checkOutHour", 0, 23),
    contactWhatsApp: phone(input.contactWhatsApp, "WhatsApp number"),
    contactPhone: phone(input.contactPhone, "Phone number"),
    contactEmail: email(input.contactEmail),
    propertyAddress: String(input.propertyAddress ?? "").trim().slice(0, 300),
    checkInInstructions: String(input.checkInInstructions ?? "").trim().slice(0, 6000),
    checkInInstructionsEs: String(input.checkInInstructionsEs ?? "").trim().slice(0, 6000),
    houseRules: String(input.houseRules ?? "").trim().slice(0, 3000) || DEFAULT_SETTINGS.houseRules,
    houseRulesEs: String(input.houseRulesEs ?? "").trim().slice(0, 3000) || DEFAULT_SETTINGS.houseRulesEs,
    reviewLink: url(input.reviewLink),
    approxArea: String(input.approxArea ?? "").trim().slice(0, 120) || DEFAULT_SETTINGS.approxArea,
    mapCenter: latLng(input.mapCenter),
    mapZoom: int(input, "mapZoom", 11, 16),
    smartPricing: validateSmart(input.smartPricing),
  };
  if (s.minNights > s.maxNights) throw new SettingsError("The minimum stay can't be longer than the longest stay.");
  if (s.monthlyMinNights <= s.weeklyMinNights) {
    throw new SettingsError("The monthly discount must start at more nights than the weekly discount.");
  }
  return s;
}

export async function saveSettings(s: Settings): Promise<Settings> {
  await query(
    `INSERT INTO settings (id, data, updated_at) VALUES (1, $1, now())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [JSON.stringify(s)],
  );
  store.__elmaSettings = { at: Date.now(), value: s };
  return s;
}

export function toPublicSettings(s: Settings): PublicSettings {
  return {
    maxGuests: s.maxGuests,
    maxPets: s.maxPets,
    petFee: s.petFee,
    directDiscountEnabled: s.directDiscountEnabled,
    directDiscountPercent: s.directDiscountPercent,
    weeklyDiscountPercent: s.weeklyDiscountPercent,
    weeklyMinNights: s.weeklyMinNights,
    monthlyDiscountPercent: s.monthlyDiscountPercent,
    monthlyMinNights: s.monthlyMinNights,
    bookingOpen: s.taxes !== null && s.icalUrls.length > 0,
    cancellationPolicy: s.cancellationPolicy,
    checkInHour: s.checkInHour,
    checkOutHour: s.checkOutHour,
  };
}
