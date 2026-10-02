"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Photo } from "@/lib/property";

function Img({ photo, size, priority = false }: { photo: Photo; size: "sm" | "lg"; priority?: boolean }) {
  return (
    // Pre-sized WebP files live in /public/photos (see README).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${photo.src}${size === "sm" ? "-sm" : ""}.webp`}
      srcSet={size === "sm" ? `${photo.src}-sm.webp 720w, ${photo.src}.webp 1600w` : undefined}
      sizes={size === "sm" ? "(max-width: 700px) 100vw, 50vw" : undefined}
      alt={photo.alt}
      width={photo.w}
      height={photo.h}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
    />
  );
}

export function Gallery({ photos }: { photos: Photo[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const show = useCallback((i: number) => {
    setOpen(i);
    dialog.current?.showModal();
  }, []);
  const close = useCallback(() => dialog.current?.close(), []);
  const step = useCallback(
    (d: number) => setOpen((i) => (i === null ? i : (i + d + photos.length) % photos.length)),
    [photos.length],
  );

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    const onClose = () => setOpen(null);
    el.addEventListener("keydown", onKey);
    el.addEventListener("close", onClose);
    return () => {
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("close", onClose);
    };
  }, [step]);

  const featured = photos.slice(0, 5);

  return (
    <section className="gallery" aria-label="Photos">
      <div className="mosaic">
        {featured.map((photo, i) => (
          <button key={photo.src} type="button" className={`tile tile-${i}`} onClick={() => show(i)}>
            <Img photo={photo} size={i === 0 ? "lg" : "sm"} priority={i === 0} />
          </button>
        ))}
        <button type="button" className="all-photos" onClick={() => show(0)}>
          See all {photos.length} photos
        </button>
      </div>

      <dialog ref={dialog} className="lightbox" aria-label="Photo viewer">
        {open !== null && (
          <>
            <figure>
              <Img photo={photos[open]} size="lg" priority />
              <figcaption>
                {photos[open].alt}
                <span className="count">
                  {open + 1} of {photos.length}
                </span>
              </figcaption>
            </figure>
            <button type="button" className="lb-close" onClick={close} aria-label="Close photos">
              ×
            </button>
            <button type="button" className="lb-prev" onClick={() => step(-1)} aria-label="Previous photo">
              ‹
            </button>
            <button type="button" className="lb-next" onClick={() => step(1)} aria-label="Next photo">
              ›
            </button>
          </>
        )}
      </dialog>
    </section>
  );
}
