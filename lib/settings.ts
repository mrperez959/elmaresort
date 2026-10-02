import "server-only";
import { query } from "./db";
import type { PublicSettings, Settings } from "./types";

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
  taxRatePercent: null, // must be set in /admin before online booking opens
  maxNights: 90,
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
  const rows = await query<{ data: Partial<Settings> }>("SELECT data FROM settings WHERE id = 1");
  const value = { ...DEFAULT_SETTINGS, ...(rows[0]?.data ?? {}) };
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

/** Validate untrusted admin input. Money is in cents. */
export function validateSettings(raw: unknown): Settings {
  const input = (raw ?? {}) as Record<string, unknown>;
  const weekendNights = Array.isArray(input.weekendNights)
    ? [...new Set(input.weekendNights.map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort()
    : DEFAULT_SETTINGS.weekendNights;

  const taxRaw = input.taxRatePercent;
  const taxRatePercent = taxRaw === null || taxRaw === "" || taxRaw === undefined ? null : percent(input, "taxRatePercent", 30);

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
    taxRatePercent,
    maxNights: int(input, "maxNights", 1, 365),
  };
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
    bookingOpen: s.taxRatePercent !== null,
  };
}
