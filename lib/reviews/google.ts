import { site, type Review } from "@/config/site";

/**
 * Google reviews, ported from Kanvas Academy's lib/reviews.ts.
 *
 * Needs one setting (Vercel → Settings → Environment Variables):
 *   GOOGLE_PLACES_API_KEY   server-only key, Places API (New) only
 *
 * The business's Place ID is looked up from Google by name (GOOGLE_PLACE_QUERY
 * below) and cached, so nobody has to find it by hand. If the lookup ever
 * picks the wrong listing, set NEXT_PUBLIC_GOOGLE_PLACE_ID and it wins.
 *
 * Google only ever returns up to 5 reviews, in its own relevance order (the
 * New API has no sort option). Cached for a month, since reviews change
 * rarely and each fetch is a billed call. Everything returns empty/fallback
 * on failure, so the homepage never breaks.
 */

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const PLACE_ID_SETTING = process.env.NEXT_PUBLIC_GOOGLE_PLACE_ID;
/** What to search Google for when the Place ID isn't set. */
const GOOGLE_PLACE_QUERY = process.env.GOOGLE_PLACE_QUERY || "Nelly & Nova dog training North Tyneside";
const ONE_MONTH_SECONDS = 60 * 60 * 24 * 30;

/** The business's Place ID: the setting if there is one, otherwise found on Google by name. */
export async function getPlaceId(): Promise<string | null> {
  if (PLACE_ID_SETTING) return PLACE_ID_SETTING;
  if (!GOOGLE_PLACES_API_KEY) return null;
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName",
      },
      body: JSON.stringify({ textQuery: GOOGLE_PLACE_QUERY, regionCode: "GB", pageSize: 5 }),
      next: { revalidate: ONE_MONTH_SECONDS },
    });
    if (!res.ok) {
      console.error(`getPlaceId: ${res.status} ${res.statusText}`, await res.text().catch(() => ""));
      return null;
    }
    const data: { places?: { id: string; displayName?: { text?: string } }[] } = await res.json();
    const places = data.places ?? [];
    // Prefer a listing actually called Nelly & Nova over whatever ranks first.
    const match = places.find((p) => /nelly/i.test(p.displayName?.text ?? ""));
    if (!match) console.error("getPlaceId: no Google listing named Nelly & Nova found", places.map((p) => p.displayName?.text));
    return match?.id ?? null;
  } catch (err) {
    console.error("getPlaceId failed", err);
    return null;
  }
}

type GooglePlaceReview = {
  rating?: number;
  text?: { text?: string };
  originalText?: { text?: string };
  relativePublishTimeDescription?: string;
  authorAttribution?: { displayName?: string; photoUri?: string };
};

export async function getGoogleReviews(): Promise<Review[]> {
  if (!GOOGLE_PLACES_API_KEY) return [];
  const placeId = await getPlaceId();
  if (!placeId) return [];
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
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
 * Place ID is known, a Google search for the business instead, so the button
 * always goes somewhere useful.
 */
export async function getWriteReviewUrl(): Promise<string> {
  const placeId = await getPlaceId();
  return placeId
    ? `https://search.google.com/local/writereview?placeid=${placeId}`
    : `https://www.google.com/search?q=${encodeURIComponent(`${site.name} dog training reviews`)}`;
}
