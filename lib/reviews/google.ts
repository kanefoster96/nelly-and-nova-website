import { site, type Review } from "@/config/site";

/**
 * Google reviews, ported from Kanvas Academy's lib/reviews.ts.
 *
 * Needs two settings (Vercel → Settings → Environment Variables):
 *   NEXT_PUBLIC_GOOGLE_PLACE_ID  the business on Google (for both features)
 *   GOOGLE_PLACES_API_KEY        server-only key, Places API (New) only
 *
 * Google only ever returns up to 5 reviews here, picked by its own relevance
 * order (there's no way to sort them — reviewsSort is a Legacy API option
 * and the New API rejects it). Cached for a month, since reviews change
 * rarely and each fetch is a billed call. Returns [] when the settings
 * aren't there or the request fails, so the homepage never breaks.
 */

const GOOGLE_PLACE_ID = process.env.NEXT_PUBLIC_GOOGLE_PLACE_ID;
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const ONE_MONTH_SECONDS = 60 * 60 * 24 * 30;

type GooglePlaceReview = {
  rating?: number;
  text?: { text?: string };
  originalText?: { text?: string };
  relativePublishTimeDescription?: string;
  authorAttribution?: { displayName?: string; photoUri?: string };
};

export async function getGoogleReviews(): Promise<Review[]> {
  if (!GOOGLE_PLACE_ID || !GOOGLE_PLACES_API_KEY) return [];
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${GOOGLE_PLACE_ID}`, {
      headers: {
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": "reviews",
      },
      next: { revalidate: ONE_MONTH_SECONDS },
    });
    if (!res.ok) {
      console.error(`getGoogleReviews: ${res.status} ${res.statusText}`, await res.text().catch(() => ""));
      return [];
    }
    const data: { reviews?: GooglePlaceReview[] } = await res.json();
    return (data.reviews ?? [])
      .map((r) => ({
        author: r.authorAttribution?.displayName ?? "Google user",
        avatar: r.authorAttribution?.photoUri,
        rating: r.rating ?? 5,
        text: r.originalText?.text ?? r.text?.text ?? "",
        date: r.relativePublishTimeDescription ?? "",
      }))
      .filter((r) => r.text);
  } catch (err) {
    console.error("getGoogleReviews failed", err);
    return [];
  }
}

/**
 * Straight to Google's "write a review" box for the business. Until the
 * Place ID is set, a Google search for the business instead, so the button
 * always goes somewhere useful.
 */
export const writeReviewUrl = GOOGLE_PLACE_ID
  ? `https://search.google.com/local/writereview?placeid=${GOOGLE_PLACE_ID}`
  : `https://www.google.com/search?q=${encodeURIComponent(`${site.name} dog training reviews`)}`;
