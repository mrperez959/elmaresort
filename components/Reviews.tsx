"use client";

import { useEffect, useRef, useState } from "react";
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
    <li data-reveal className="review">
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

/** The rating counts up from 0 the first time it scrolls into view (once). */
function CountUp({ value }: { value: number }) {
  const decimals = Number.isInteger(value) ? 1 : String(value).split(".")[1].length;
  const final = value.toFixed(decimals);
  const ref = useRef<HTMLSpanElement>(null);
  const [text, setText] = useState(final);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) return; // already on screen: leave it
    setText((0).toFixed(decimals));
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 1100);
        const eased = 1 - Math.pow(1 - t, 4);
        setText((value * eased).toFixed(decimals));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { rootMargin: "0px 0px -15% 0px" });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, decimals]);

  return (
    <span ref={ref} className="score-number" aria-label={final}>
      {text}
    </span>
  );
}

export function Reviews({ summary }: { summary: ReviewSummary }) {
  const { l } = useL();
  const [shown, setShown] = useState(6);
  const avg = summary.average;

  return (
    <section className="reviews" aria-labelledby="reviews-heading">
      <div className="reviews-head" data-reveal>
        <h2 id="reviews-heading">{l("What guests say", "Lo que dicen los huéspedes")}</h2>
        {avg !== null && (
          <div className="score">
            <CountUp value={avg} />
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
          <ul className="review-grid" data-reveal-group>
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
