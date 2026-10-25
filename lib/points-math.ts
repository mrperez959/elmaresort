// Pure balance math for Elma Points, so it can be tested without a database.
//
// Every positive ledger row is a "lot" with its own expiry date. Spending
// (negative rows) consumes the lots that expire soonest first, counting only
// lots that were still valid at the moment of the spend. What is left in lots
// that have not expired yet is the available balance.

export type LedgerRow = { delta: number; expiresOn: string | null; createdOn: string };

export type Balance = {
  available: number;
  /** soonest expiry among the points still available, and how many expire then */
  nextExpiry: { date: string; points: number } | null;
};

export function computeBalance(rows: LedgerRow[], today: string): Balance {
  const sorted = [...rows].sort((a, b) => a.createdOn.localeCompare(b.createdOn) || b.delta - a.delta);
  const lots: Array<{ left: number; expiresOn: string | null }> = [];

  for (const r of sorted) {
    if (r.delta > 0) {
      lots.push({ left: r.delta, expiresOn: r.expiresOn });
      continue;
    }
    let need = -r.delta;
    const usable = lots
      .filter((l) => l.left > 0 && (l.expiresOn === null || l.expiresOn >= r.createdOn))
      .sort((a, b) => (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999"));
    for (const l of usable) {
      if (need === 0) break;
      const take = Math.min(l.left, need);
      l.left -= take;
      need -= take;
    }
    // need > 0 only happens with a manual negative adjustment larger than the
    // balance: the balance simply bottoms out at zero.
  }

  const alive = lots.filter((l) => l.left > 0 && (l.expiresOn === null || l.expiresOn >= today));
  const available = alive.reduce((s, l) => s + l.left, 0);
  const dated = alive.filter((l) => l.expiresOn !== null).sort((a, b) => a.expiresOn!.localeCompare(b.expiresOn!));
  const nextExpiry = dated.length
    ? {
        date: dated[0].expiresOn!,
        points: dated.filter((l) => l.expiresOn === dated[0].expiresOn).reduce((s, l) => s + l.left, 0),
      }
    : null;
  return { available, nextExpiry };
}

/** Points earned by a post: likes and comments, capped per post. */
export function pointsForPost(
  likes: number,
  comments: number,
  rules: { pointsPerLike: number; pointsPerComment: number; maxPointsPerPost: number },
) {
  const raw = Math.max(0, likes) * rules.pointsPerLike + Math.max(0, comments) * rules.pointsPerComment;
  return Math.min(raw, rules.maxPointsPerPost);
}

/**
 * How many points a stay can use and what they're worth: capped by what was
 * requested and by the max % of the nights. Uses only as many points as needed.
 */
export function pointsDiscount(
  requested: number,
  nightsAfterOtherDiscounts: number,
  rules: { centsPerPoint: number; maxDiscountPercent: number },
): { points: number; amount: number } | null {
  const want = Math.max(0, Math.floor(requested));
  if (!want || nightsAfterOtherDiscounts <= 0) return null;
  const cap = Math.floor((nightsAfterOtherDiscounts * rules.maxDiscountPercent) / 100);
  const amount = Math.min(want * rules.centsPerPoint, cap);
  if (amount <= 0) return null;
  const points = Math.ceil(amount / rules.centsPerPoint);
  return { points, amount };
}

/** Adds months to an ISO date (clamped to the last day of the month). */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}
