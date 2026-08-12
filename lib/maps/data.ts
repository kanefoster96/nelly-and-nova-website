/**
 * Geocoding seam (server-only).
 * -----------------------------
 * Turns an address into coordinates for future route / collection-run features.
 * Uses the Google Geocoding API when `GOOGLE_MAPS_API_KEY` is set; otherwise
 * returns a deterministic point near Tynemouth so the scaffold still has usable
 * coordinates. Best-effort — never throws.
 */
import type { GeoPoint } from "./geo";

const TYNEMOUTH: GeoPoint = { lat: 55.017, lng: -1.423 };

export type GeocodeResult = GeoPoint & { formatted: string };

export async function geocode(address: string): Promise<GeocodeResult | null> {
  if (!address.trim()) return null;

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (key) {
    try {
      const url =
        `https://maps.googleapis.com/maps/api/geocode/json` +
        `?address=${encodeURIComponent(address)}&key=${key}`;
      const res = await fetch(url, { next: { revalidate: 86_400 } });
      const j = await res.json();
      const r = j?.results?.[0];
      if (r?.geometry?.location) {
        return {
          lat: r.geometry.location.lat,
          lng: r.geometry.location.lng,
          formatted: r.formatted_address ?? address,
        };
      }
    } catch {
      // fall through to the deterministic stand-in
    }
  }

  // Deterministic stand-in: jitter around Tynemouth by a hash of the address,
  // so different customers get distinct, stable pins without a key.
  const h = [...address].reduce((n, c, i) => n + c.charCodeAt(0) * (i + 1), 0);
  return {
    lat: TYNEMOUTH.lat + ((h % 200) - 100) / 5000, // ±0.02°
    lng: TYNEMOUTH.lng + (((h >> 3) % 200) - 100) / 5000,
    formatted: address,
  };
}
