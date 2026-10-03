import "server-only";
import { hospitable } from "./hospitable";
import { env } from "./env";

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
  average: number;
  count: number;
  /** platforms the reviews came from, most reviews first */
  platforms: string[];
  items: PublicReview[];
};

const PLATFORMS: Record<string, string> = {
  airbnb: "Airbnb",
  homeaway: "Vrbo",
  vrbo: "Vrbo",
  booking: "Booking.com",
  "booking.com": "Booking.com",
  direct: "Direct booking",
  manual: "Direct booking",
};

const CACHE_MS = 60 * 60_000; // reviews change slowly
const MAX_SHOWN = 24;
const shared = globalThis as unknown as { __elmaReviews?: { at: number; value: ReviewSummary | null } };

/**
 * Real guest reviews from every platform connected to Hospitable.
 * The average and count use ALL reviews; the cards show the most recent
 * ones that have text, whatever their rating.
 */
export async function getReviews(): Promise<ReviewSummary | null> {
  const hit = shared.__elmaReviews;
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  try {
    const all = [];
    for await (const r of hospitable().reviews.iter(env.propertyId(), { include: "guest", perPage: 100 })) {
      all.push(r);
      if (all.length >= 1000) break;
    }
    const rated = all.filter((r) => r.public?.rating >= 1);
    const value: ReviewSummary | null = rated.length
      ? {
          average: Math.round((rated.reduce((sum, r) => sum + r.public.rating, 0) / rated.length) * 100) / 100,
          count: rated.length,
          platforms: Object.entries(
            rated.reduce<Record<string, number>>((acc, r) => {
              const name = PLATFORMS[r.platform?.toLowerCase()] ?? r.platform;
              acc[name] = (acc[name] ?? 0) + 1;
              return acc;
            }, {}),
          )
            .sort((a, b) => b[1] - a[1])
            .map(([name]) => name),
          items: rated
            .filter((r) => r.public.review?.trim())
            .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))
            .slice(0, MAX_SHOWN)
            .map((r) => ({
              id: r.id,
              // First name and last initial only, for the guest's privacy.
              name: r.guest
                ? `${r.guest.firstName}${r.guest.lastName ? ` ${r.guest.lastName.charAt(0)}.` : ""}`
                : "Guest",
              month: r.reviewedAt.slice(0, 7),
              platform: PLATFORMS[r.platform?.toLowerCase()] ?? r.platform,
              rating: r.public.rating,
              text: r.public.review.trim(),
            })),
        }
      : null;
    shared.__elmaReviews = { at: Date.now(), value };
    return value;
  } catch (err) {
    console.error("[reviews]", err);
    // Remember the failure briefly so a Hospitable outage doesn't slow every page.
    shared.__elmaReviews = { at: Date.now() - CACHE_MS + 5 * 60_000, value: null };
    return null;
  }
}
