import "server-only";
import { query } from "./db";
import { getSettings } from "./settings";

export type PublicReview = {
  id: string;
  name: string;
  /** YYYY-MM */
  month: string;
  platform: string;
  rating: number;
  text: string;
};

export type ReviewSummary = {
  /** Overall rating copied from the listing, or null if not entered */
  average: number | null;
  count: number | null;
  platform: string;
  items: PublicReview[];
};

type Row = { id: string; name: string; month: string; platform: string; rating: number; body: string };

export async function listReviews(): Promise<PublicReview[]> {
  const rows = await query<Row>("SELECT * FROM reviews ORDER BY month DESC, created_at DESC LIMIT 200");
  return rows.map((r) => ({ id: r.id, name: r.name, month: r.month, platform: r.platform, rating: r.rating, text: r.body }));
}

/** Reviews entered in /admin plus the overall rating from the listing. Null if there's nothing to show. */
export async function getReviews(): Promise<ReviewSummary | null> {
  const [settings, items] = await Promise.all([getSettings(), listReviews()]);
  if (!items.length && settings.reviewsAverage === null) return null;
  return {
    average: settings.reviewsAverage,
    count: settings.reviewsCount,
    platform: settings.reviewsPlatform,
    items,
  };
}

export class ReviewError extends Error {}

export async function addReview(raw: unknown): Promise<PublicReview> {
  const b = (raw ?? {}) as Record<string, unknown>;
  const name = String(b.name ?? "").trim().slice(0, 60);
  const month = String(b.month ?? "").trim();
  const platform = String(b.platform ?? "").trim().slice(0, 40) || "Airbnb";
  const rating = Number(b.rating);
  const text = String(b.text ?? "").trim().slice(0, 3000);
  if (!name) throw new ReviewError("Enter the guest's name as it appears on the platform.");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new ReviewError("Pick the month of the review.");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ReviewError("The rating must be 1 to 5 stars.");
  if (text.length < 5) throw new ReviewError("Paste the review text.");
  const rows = await query<Row>(
    "INSERT INTO reviews (name, month, platform, rating, body) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [name, month, platform, rating, text],
  );
  const r = rows[0];
  return { id: r.id, name: r.name, month: r.month, platform: r.platform, rating: r.rating, text: r.body };
}

export async function deleteReview(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await query("DELETE FROM reviews WHERE id = $1", [id]);
}
