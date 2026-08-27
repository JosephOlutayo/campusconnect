const EARTH_RADIUS_MILES = 3958.8;

export type Point = { latitude: number; longitude: number };

export function distanceMiles(a: Point, b: Point): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(miles: number): string {
  if (miles < 0.1) return "On campus";
  return `${miles.toFixed(1)} mi`;
}

/**
 * Jitters a real address into a ~0.3 mile blur for public display.
 * Providers' exact coordinates are never sent to the browser; this is what the
 * map pin and distance figures are computed from.
 */
export function approximate(point: Point, seed: string): Point {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const offsetLat = ((hash % 100) / 100 - 0.5) * 0.008;
  const offsetLon = (((hash >> 7) % 100) / 100 - 0.5) * 0.008;
  return { latitude: point.latitude + offsetLat, longitude: point.longitude + offsetLon };
}
