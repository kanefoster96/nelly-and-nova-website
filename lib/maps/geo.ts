/**
 * Google Maps helpers.
 * --------------------
 * Turns a free-text address into a real map pin. The deep links need no API key
 * and work today; the static-map preview and geocoding use a key when set (see
 * lib/maps/data.ts and .env.example). Coordinates from geocoding are the
 * foundation for future route / collection-run features.
 */
export type GeoPoint = { lat: number; lng: number };

/** Opens Google Maps with a pin dropped at the address. No API key needed. */
export function mapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** Directions to an address (optionally from an origin) — for route features. */
export function mapsDirectionsUrl(destination: string, origin?: string): string {
  const d = `destination=${encodeURIComponent(destination)}`;
  const o = origin ? `&origin=${encodeURIComponent(origin)}` : "";
  return `https://www.google.com/maps/dir/?api=1&${d}${o}`;
}

/**
 * A Static Maps image URL with a marker at the address, or null if no public
 * key is configured (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`).
 */
export function staticMapUrl(
  query: string,
  opts?: { zoom?: number; w?: number; h?: number; key?: string }
): string | null {
  const key = opts?.key ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key || !query.trim()) return null;
  const q = encodeURIComponent(query);
  const size = `${opts?.w ?? 600}x${opts?.h ?? 160}`;
  const zoom = opts?.zoom ?? 14;
  return (
    `https://maps.googleapis.com/maps/api/staticmap?center=${q}&zoom=${zoom}` +
    `&size=${size}&scale=2&markers=color:0x8a8078%7C${q}&key=${key}`
  );
}
