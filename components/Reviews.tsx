"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import type { PublicReview, ReviewSummary } from "@/lib/reviews";
import { useL } from "./LangProvider";
import { locale, type Lang } from "@/lib/i18n";

function Stars({ rating }: { rating: number }) {
  const { l } = useL();
  return (
    <span className="stars" aria-label={l(`${rating} out of 5 stars`, `${rating} de 5 estrellas`)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={15} strokeWidth={1.5} className={n <= Math.round(rating) ? "on" : "off"} aria-hidden="true" />
      ))}
    </span>
  );
}

function monthLabel(ym: string, lang: Lang) {
  return new Intl.DateTimeFormat(locale(lang), { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${ym}-15T12:00:00Z`),
  );
}

function ReviewCard({ review }: { review: PublicReview }) {
  const { lang, l } = useL();
  const long = review.text.length > 320;
  const [open, setOpen] = useState(false);
  return (
    <li className="review">
      <Stars rating={review.rating} />
      <p className={`review-text ${long && !open ? "clamped" : ""}`}>{review.text}</p>
      {long && (
        <button type="button" className="link" onClick={() => setOpen(!open)}>
          {open ? l("Show less", "Ver menos") : l("Read more", "Leer más")}
        </button>
      )}
      <p className="review-by">
        <strong>{review.name}</strong>
        <span>
          {monthLabel(review.month, lang)}, {review.platform}
        </span>
      </p>
    </li>
  );
}

export function Reviews({ summary }: { summary: ReviewSummary }) {
  const { l } = useL();
  const [shown, setShown] = useState(6);
  const avg = summary.average;

  return (
    <section className="reviews" aria-labelledby="reviews-heading">
      <div className="reviews-head">
        <h2 id="reviews-heading">{l("What guests say", "Lo que dicen los huéspedes")}</h2>
        {avg !== null && (
          <div className="score">
            <span className="score-number">{Number.isInteger(avg) ? avg.toFixed(1) : String(avg)}</span>
            <div>
              <Stars rating={avg} />
              <div className="score-count">
                {summary.count
                  ? l(`${summary.count} ${summary.count === 1 ? "review" : "reviews"} on `, `${summary.count} ${summary.count === 1 ? "reseña" : "reseñas"} en `)
                  : l("Rating on ", "Calificación en ")}
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
              {l(`Show ${summary.items.length - shown} more`, `Ver ${summary.items.length - shown} más`)}
            </button>
          )}
        </>
      )}
    </section>
  );
}
