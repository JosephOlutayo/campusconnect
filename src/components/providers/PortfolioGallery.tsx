"use client";

import { useEffect, useState } from "react";

import { SeedImage } from "@/components/ui/SeedImage";
import { Icon } from "@/components/ui/Icon";

type Image = { id: string; seed: string; url: string | null; caption: string | null };

/**
 * Swipe-friendly on phones (a snapping scroll rail), grid on desktop, with a
 * lightbox that supports arrow keys. No carousel library involved.
 */
export function PortfolioGallery({ images, name }: { images: Image[]; name: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenIndex(null);
      if (event.key === "ArrowRight") setOpenIndex((index) => ((index ?? 0) + 1) % images.length);
      if (event.key === "ArrowLeft")
        setOpenIndex((index) => ((index ?? 0) - 1 + images.length) % images.length);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [openIndex, images.length]);

  if (images.length === 0) {
    return (
      <p className="rounded-2xl bg-surface-sunken px-4 py-6 text-center text-sm text-ink-muted">
        No portfolio photos yet.
      </p>
    );
  }

  return (
    <>
      <div className="rail -mx-1 flex gap-3 px-1 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
        {images.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setOpenIndex(index)}
            aria-label={`View photo ${index + 1} of ${images.length}`}
            className="w-40 shrink-0 snap-start overflow-hidden rounded-2xl transition-transform hover:scale-[1.02] sm:w-auto"
          >
            <SeedImage
              seed={image.seed}
              url={image.url}
              alt={image.caption ?? `${name} work sample`}
              className="aspect-[4/5] w-full sm:aspect-square"
              label={image.caption}
            />
          </button>
        ))}
      </div>

      {openIndex !== null ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-feature/90 p-4">
          <button
            aria-label="Close gallery"
            onClick={() => setOpenIndex(null)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20"
          >
            <Icon name="plus" className="rotate-45" size={22} />
          </button>

          <button
            aria-label="Previous photo"
            onClick={() => setOpenIndex((index) => ((index ?? 0) - 1 + images.length) % images.length)}
            className="absolute left-3 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20"
          >
            <Icon name="arrowLeft" size={22} />
          </button>

          <figure className="max-h-[85vh] w-full max-w-2xl">
            <SeedImage
              seed={images[openIndex].seed}
              url={images[openIndex].url}
              alt={images[openIndex].caption ?? `${name} work sample`}
              className="aspect-square w-full rounded-3xl"
            />
            <figcaption className="mt-3 text-center text-sm text-white/70">
              {images[openIndex].caption ?? `${openIndex + 1} of ${images.length}`}
            </figcaption>
          </figure>

          <button
            aria-label="Next photo"
            onClick={() => setOpenIndex((index) => ((index ?? 0) + 1) % images.length)}
            className="absolute right-3 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20"
          >
            <Icon name="arrowRight" size={22} />
          </button>
        </div>
      ) : null}
    </>
  );
}
