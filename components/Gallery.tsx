"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Photo } from "@/lib/property";
import { track } from "@/lib/track";
import { useL } from "./LangProvider";

function Img({ photo, size, priority = false }: { photo: Photo; size: "sm" | "lg"; priority?: boolean }) {
  const { lang } = useL();
  return (
    // Pre-sized WebP files live in /public/photos (see README).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${photo.src}${size === "sm" ? "-sm" : ""}.webp`}
      srcSet={size === "sm" ? `${photo.src}-sm.webp 720w, ${photo.src}.webp 1600w` : undefined}
      sizes={size === "sm" ? "(max-width: 700px) 100vw, 50vw" : undefined}
      alt={lang === "es" ? photo.altEs : photo.alt}
      width={photo.w}
      height={photo.h}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
    />
  );
}

export function Gallery({ photos }: { photos: Photo[] }) {
  const { lang, l } = useL();
  const [open, setOpen] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  // Time spent on each photo and in the viewer overall.
  const viewerSince = useRef<number | null>(null);
  const photoSince = useRef<{ n: number; at: number } | null>(null);

  useEffect(() => {
    const now = Date.now();
    if (photoSince.current) {
      const ms = now - photoSince.current.at;
      if (ms > 300) track("photo_view", { n: photoSince.current.n, ms });
    }
    photoSince.current = open === null ? null : { n: open, at: now };
    if (open !== null && viewerSince.current === null) {
      viewerSince.current = now;
      track("gallery_open", { n: open });
    }
    if (open === null && viewerSince.current !== null) {
      track("gallery_time", { ms: now - viewerSince.current });
      viewerSince.current = null;
    }
  }, [open]);

  const show = useCallback((i: number) => {
    setOpen(i);
    dialog.current?.showModal();
  }, []);
  const close = useCallback(() => dialog.current?.close(), []);
  const step = useCallback(
    (d: number) => setOpen((i) => (i === null ? i : (i + d + photos.length) % photos.length)),
    [photos.length],
  );

  // ---------- Slide animation and swipe ----------
  // The viewer shows a strip of three photos (previous, current, next) and
  // moves it with the finger. Letting go past the threshold slides to the
  // neighbour; otherwise it springs back.
  const viewport = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [animating, setAnimating] = useState(false);
  const busy = useRef(false);
  const SLIDE_MS = 260;

  const reducedMotion = () =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const go = useCallback(
    (dir: 1 | -1) => {
      if (busy.current) return;
      if (reducedMotion()) {
        step(dir);
        setDragX(0);
        return;
      }
      busy.current = true;
      const w = viewport.current?.clientWidth ?? window.innerWidth;
      setAnimating(true);
      setDragX(dir === 1 ? -w : w);
      window.setTimeout(() => {
        // Swap the photos and recenter in the same render: no visible jump.
        setAnimating(false);
        step(dir);
        setDragX(0);
        busy.current = false;
      }, SLIDE_MS);
    },
    [step],
  );

  const springBack = () => {
    setAnimating(true);
    setDragX(0);
    window.setTimeout(() => setAnimating(false), SLIDE_MS);
  };

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    const onClose = () => {
      setOpen(null);
      setDragX(0);
      setAnimating(false);
      busy.current = false;
    };
    el.addEventListener("keydown", onKey);
    el.addEventListener("close", onClose);
    return () => {
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("close", onClose);
    };
  }, [go]);

  const touch = useRef<{ x: number; y: number; t: number; axis: "x" | "y" | null } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    if (busy.current || e.touches.length !== 1) {
      touch.current = null; // pinch-zoom or mid-animation: not a swipe
      return;
    }
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), axis: null };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const t = touch.current;
    if (!t || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - t.x;
    const dy = e.touches[0].clientY - t.y;
    if (!t.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 8) t.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (t.axis === "x") setDragX(dx); // the photo follows the finger
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const t = touch.current;
    touch.current = null;
    if (!t || t.axis !== "x" || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - t.x;
    const w = viewport.current?.clientWidth ?? window.innerWidth;
    const fast = Date.now() - t.t < 300;
    if (Math.abs(dx) > w * 0.2 || (fast && Math.abs(dx) > 35)) go(dx < 0 ? 1 : -1);
    else springBack();
  };

  const featured = photos.slice(0, 5);

  return (
    <section className="gallery" aria-label={l("Photos", "Fotos")}>
      <div className="mosaic">
        {featured.map((photo, i) => (
          <button key={photo.src} type="button" className={`tile tile-${i}`} onClick={() => show(i)}>
            <Img photo={photo} size={i === 0 ? "lg" : "sm"} priority={i === 0} />
          </button>
        ))}
        <button type="button" className="all-photos" onClick={() => show(0)}>
          {l(`See all ${photos.length} photos`, `Ver las ${photos.length} fotos`)}
        </button>
      </div>

      <dialog ref={dialog} className="lightbox" aria-label={l("Photo viewer", "Visor de fotos")}>
        {open !== null && (
          <>
            <div
              ref={viewport}
              className="lb-viewport"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onTouchCancel={springBack}
            >
              <div
                className={`lb-track${animating ? " animating" : ""}`}
                style={{ transform: `translateX(calc(-100% / 3 + ${dragX}px))` }}
              >
                {[-1, 0, 1].map((offset) => {
                  const i = (open + offset + photos.length) % photos.length;
                  return (
                    <div key={`${offset}:${i}`} className="lb-slide" aria-hidden={offset !== 0}>
                      <Img photo={photos[i]} size="lg" priority />
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="lb-caption">
              {lang === "es" ? photos[open].altEs : photos[open].alt}
              <span className="count">
                {open + 1} {l("of", "de")} {photos.length}
              </span>
            </p>
            <button type="button" className="lb-close" onClick={close} aria-label={l("Close photos", "Cerrar fotos")}>
              ×
            </button>
            <button type="button" className="lb-prev" onClick={() => go(-1)} aria-label={l("Previous photo", "Foto anterior")}>
              ‹
            </button>
            <button type="button" className="lb-next" onClick={() => go(1)} aria-label={l("Next photo", "Foto siguiente")}>
              ›
            </button>
          </>
        )}
      </dialog>
    </section>
  );
}
