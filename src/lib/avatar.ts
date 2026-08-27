// Deterministic visuals from a seed string.
//
// The marketplace needs a face for every profile and a photo for every
// portfolio tile. Rather than depend on an external image host (which breaks
// offline and leaks nothing useful), every image is a gradient derived from a
// stable seed, so the same provider always looks the same. Once real uploads
// exist, PortfolioImage.url takes precedence and this becomes the fallback.

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/** Hues chosen to stay readable against white cards in both themes. */
const HUE_STOPS = [212, 258, 288, 330, 8, 26, 44, 152, 178, 196];

export function seedGradient(seed: string): string {
  const hash = hashSeed(seed);
  const hueA = HUE_STOPS[hash % HUE_STOPS.length];
  const hueB = HUE_STOPS[(hash >> 3) % HUE_STOPS.length];
  const angle = 120 + (hash % 120);
  return `linear-gradient(${angle}deg, hsl(${hueA} 72% 58%), hsl(${hueB} 68% 44%))`;
}

export function seedColor(seed: string): string {
  const hash = hashSeed(seed);
  return `hsl(${HUE_STOPS[hash % HUE_STOPS.length]} 70% 52%)`;
}

/** A softer tint for badges and category chips. */
export function seedTint(seed: string): string {
  const hash = hashSeed(seed);
  return `hsl(${HUE_STOPS[hash % HUE_STOPS.length]} 82% 95%)`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Stable pseudo-random in [0,1) for demo data and portfolio variation. */
export function seedRandom(seed: string): number {
  return (hashSeed(seed) % 100000) / 100000;
}
