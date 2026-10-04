import "server-only";
import { query } from "./db";
import type { PublicSettings, Settings } from "./types";
import { isPolicyId } from "./policy";

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
  approxArea: "Town 'n' Country, Tampa, FL",
  mapCenter: "",
  mapZoom: 15,
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
  // 3 decimals is about 100 m: plenty for an area map, never a house.
  return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
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
    checkInInstructions: String(input.checkInInstructions ?? "").trim().slice(0, 4000),
    approxArea: String(input.approxArea ?? "").trim().slice(0, 120) || DEFAULT_SETTINGS.approxArea,
    mapCenter: latLng(input.mapCenter),
    mapZoom: int(input, "mapZoom", 11, 16),
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
