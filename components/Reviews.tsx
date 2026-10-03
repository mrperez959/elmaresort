"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import type { PublicReview, ReviewSummary } from "@/lib/reviews";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={15} strokeWidth={1.5} className={n <= Math.round(rating) ? "on" : "off"} aria-hidden="true" />
      ))}
    </span>
  );
}

function monthLabel(ym: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${ym}-15T12:00:00Z`),
  );
}

function ReviewCard({ review }: { review: PublicReview }) {
  const long = review.text.length > 320;
  const [open, setOpen] = useState(false);
  return (
    <li className="review">
      <Stars rating={review.rating} />
      <p className={`review-text ${long && !open ? "clamped" : ""}`}>{review.text}</p>
      {long && (
        <button type="button" className="link" onClick={() => setOpen(!open)}>
          {open ? "Show less" : "Read more"}
        </button>
      )}
      <p className="review-by">
        <strong>{review.name}</strong>
        <span>
          {monthLabel(review.month)}, {review.platform}
        </span>
      </p>
    </li>
  );
}

export function Reviews({ summary }: { summary: ReviewSummary }) {
  const [shown, setShown] = useState(6);
  const avg = summary.average;

  return (
    <section className="reviews" aria-labelledby="reviews-heading">
      <div className="reviews-head">
        <h2 id="reviews-heading">What guests say</h2>
        {avg !== null && (
          <div className="score">
            <span className="score-number">{Number.isInteger(avg) ? avg.toFixed(1) : String(avg)}</span>
            <div>
              <Stars rating={avg} />
              <div className="score-count">
                {summary.count ? `${summary.count} ${summary.count === 1 ? "review" : "reviews"} on ` : "Rating on "}
                {summary.platform}
              </div>
            </div>
          </div>
        )}
      </div>
      {summary.items.length > 0 && (
        <>
          <ul className="review-grid">
            {summary.items.slice(0, shown).map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </ul>
          {shown < summary.items.length && (
            <button type="button" className="more-reviews" onClick={() => setShown(summary.items.length)}>
              Show {summary.items.length - shown} more {summary.items.length - shown === 1 ? "review" : "reviews"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
