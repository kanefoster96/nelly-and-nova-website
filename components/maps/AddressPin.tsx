"use client";

import { MapPinIcon } from "@/components/ui/Icons";
import { mapsSearchUrl, staticMapUrl } from "@/lib/maps/geo";

/**
 * Renders an address as a real map pin: a "View on map" link that opens Google
 * Maps at the location (works with no API key), plus a static-map preview when
 * NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is configured. Groundwork for route features.
 */
export function AddressPin({
  address,
  showMap = true,
}: {
  address: string;
  showMap?: boolean;
}) {
  const value = address?.trim();
  if (!value) return null;

  const href = mapsSearchUrl(value);
  const map = showMap ? staticMapUrl(value, { w: 600, h: 160 }) : null;

  return (
    <div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
      >
        <MapPinIcon width={16} height={16} /> View on map
      </a>
      {map && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${value} in Google Maps`}
          className="mt-2 block overflow-hidden rounded-xl ring-1 ring-white/10"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={map} alt={`Map showing ${value}`} className="block w-full" />
        </a>
      )}
    </div>
  );
}
