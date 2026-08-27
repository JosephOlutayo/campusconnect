import { seedGradient, seedRandom } from "@/lib/avatar";

type Props = {
  seed: string;
  url?: string | null;
  alt?: string;
  className?: string;
  label?: string | null;
};

/**
 * Portfolio / review imagery.
 *
 * When a real upload exists (`url`), it wins. Otherwise this renders a
 * deterministic gradient plate with soft light blooms so galleries read as
 * photography-shaped content rather than grey boxes. Replacing this with a
 * Cloudinary <Image> later is a one-component change.
 */
export function SeedImage({ seed, url, alt = "", className = "", label }: Props) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- user uploads are on an arbitrary host
    return <img src={url} alt={alt} className={`object-cover ${className}`} loading="lazy" />;
  }

  const r1 = seedRandom(seed);
  const r2 = seedRandom(`${seed}-b`);
  const r3 = seedRandom(`${seed}-c`);

  return (
    <div
      role="img"
      aria-label={alt || label || "Portfolio image"}
      className={`relative overflow-hidden ${className}`}
      style={{ backgroundImage: seedGradient(seed) }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at ${20 + r1 * 60}% ${15 + r2 * 40}%, rgba(255,255,255,0.42), transparent 55%),
                       radial-gradient(circle at ${70 - r3 * 40}% ${80 - r1 * 30}%, rgba(0,0,0,0.28), transparent 60%)`,
        }}
      />
      {label ? (
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-3 text-xs font-medium text-white">
          {label}
        </span>
      ) : null}
    </div>
  );
}
