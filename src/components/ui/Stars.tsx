type Props = {
  rating: number;
  count?: number;
  size?: "sm" | "md" | "lg";
  showNumber?: boolean;
  className?: string;
};

const sizes = { sm: "size-3.5", md: "size-4", lg: "size-5" };

const STAR_PATH =
  "M10 15.27L15.18 18l-1.64-6.03L18 7.24l-6.19-.53L10 1 8.19 6.71 2 7.24l4.46 4.73L4.82 18z";

function StarRow({ color, className }: { color: string; className: string }) {
  return (
    <span className="flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((index) => (
        <svg key={index} viewBox="0 0 20 20" className={className} fill={color} aria-hidden>
          <path d={STAR_PATH} />
        </svg>
      ))}
    </span>
  );
}

/**
 * Partial stars come from clipping a gold row over a grey one by percentage
 * width — no SVG gradient ids, so nothing here can differ between the server
 * render and hydration.
 */
export function Stars({ rating, count, size = "md", showNumber = true, className = "" }: Props) {
  const clamped = Math.max(0, Math.min(5, rating));

  // A provider nobody has reviewed yet. Five empty stars read as a score of
  // zero rather than an absence of one, and the full row does not fit a card
  // at its narrowest — the words alone are both clearer and shorter.
  if (count === 0) {
    return (
      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${className}`}>
        {showNumber ? <span className="text-sm font-semibold text-ink">New</span> : null}
        <span className="text-sm text-ink-muted">
          {showNumber ? "· no reviews yet" : "No reviews yet"}
        </span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="relative inline-block" aria-label={`${clamped.toFixed(1)} out of 5`}>
        <StarRow color="#E4E2DC" className={sizes[size]} />
        <span
          className="absolute inset-y-0 left-0 overflow-hidden"
          style={{ width: `${(clamped / 5) * 100}%` }}
        >
          <StarRow color="#F5A524" className={sizes[size]} />
        </span>
      </span>
      {showNumber ? (
        <span className="text-sm font-semibold text-ink">
          {clamped > 0 ? clamped.toFixed(1) : "New"}
        </span>
      ) : null}
      {count !== undefined ? (
        <span className="text-sm text-ink-muted">
          {count > 0 ? `(${count})` : "· no reviews yet"}
        </span>
      ) : null}
    </span>
  );
}

/** Interactive picker used on the review form. */
export function StarPicker({
  value,
  onChange,
  name = "rating",
}: {
  value: number;
  onChange: (value: number) => void;
  name?: string;
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
          onClick={() => onChange(star)}
          className="rounded-lg p-1 transition-transform hover:scale-110"
        >
          <svg
            viewBox="0 0 20 20"
            className="size-8"
            fill={star <= value ? "#F5A524" : "#E4E2DC"}
            aria-hidden
          >
            <path d={STAR_PATH} />
          </svg>
        </button>
      ))}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
