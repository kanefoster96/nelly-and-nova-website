/**
 * Owner-tracked walks/training sessions — real `walks`, `walk_points` and
 * `walk_photos` tables (see the "walk_tracker" and "walk_tracker_strava"
 * migrations), separate from the trainer-booked `training_sessions`. A walk
 * row is created the moment you hit Start (so homework marked off mid-walk
 * has something to link to) and updated when you stop; the route is
 * sampled client-side during tracking and batch-inserted on save.
 */
import { supabase } from "@/lib/supabase";
import { createPost } from "@/lib/community";
import { uploadImage } from "@/lib/storage";

export type WalkKind = "walk" | "training";

export type LatLng = { lat: number; lng: number };

export type Walk = {
  id: string;
  dogId: string;
  kind: WalkKind;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  notes: string;
  locationName: string;
  startLocation: LatLng | null;
  sharedPostId: string | null;
};

export type WalkPhoto = { id: string; url: string };

export type HomeworkItem = {
  id: string;
  drillName: string;
  note: string;
  pillar: string | null;
  category: string | null;
};

const WALK_COLUMNS =
  "id, dog_id, kind, started_at, ended_at, duration_seconds, distance_meters, notes, location_name, start_lat, start_lng, shared_post_id";

type WalkRow = {
  id: string;
  dog_id: string;
  kind: WalkKind;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  notes: string | null;
  location_name: string | null;
  start_lat: number | null;
  start_lng: number | null;
  shared_post_id: string | null;
};

function mapWalk(d: WalkRow): Walk {
  return {
    id: d.id,
    dogId: d.dog_id,
    kind: d.kind,
    startedAt: d.started_at,
    endedAt: d.ended_at,
    durationSeconds: d.duration_seconds,
    distanceMeters: d.distance_meters,
    notes: d.notes ?? "",
    locationName: d.location_name ?? "",
    startLocation: d.start_lat != null && d.start_lng != null ? { lat: d.start_lat, lng: d.start_lng } : null,
    sharedPostId: d.shared_post_id,
  };
}

/** Total distance (metres) along a route, summing consecutive great-circle segments. */
export function routeDistanceMeters(points: LatLng[]): number {
  const R = 6371000;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    total += R * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
  }
  return Math.round(total);
}

/** Start a walk/training session — inserts immediately so homework marks have a walk to link to. */
export async function startWalk(input: { dogId: string; kind: WalkKind; location: LatLng | null }): Promise<Walk | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("walks")
    .insert({
      account_id: user.id,
      dog_id: input.dogId,
      kind: input.kind,
      start_lat: input.location?.lat ?? null,
      start_lng: input.location?.lng ?? null,
    })
    .select(WALK_COLUMNS)
    .single();

  if (error || !data) return null;
  return mapWalk(data);
}

/** Stop a walk — records duration, distance, notes/place, end location and the sampled route. */
export async function finishWalk(
  walkId: string,
  input: {
    durationSeconds: number;
    distanceMeters: number;
    notes: string;
    locationName: string;
    endLocation: LatLng | null;
    points: LatLng[];
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("walks")
    .update({
      ended_at: new Date().toISOString(),
      duration_seconds: input.durationSeconds,
      distance_meters: input.distanceMeters,
      notes: input.notes,
      location_name: input.locationName || null,
      end_lat: input.endLocation?.lat ?? null,
      end_lng: input.endLocation?.lng ?? null,
    })
    .eq("id", walkId);
  if (error) return { error: error.message };

  if (input.points.length > 0) {
    const rows = input.points.map((p, i) => ({
      walk_id: walkId,
      sequence: i,
      lat: p.lat,
      lng: p.lng,
      recorded_at: new Date().toISOString(),
    }));
    await supabase.from("walk_points").insert(rows);
  }

  return { error: null };
}

/** Upload photos for a walk and attach them (returns the public URLs, for reuse when sharing). */
export async function uploadWalkPhotos(walkId: string, localUris: string[]): Promise<string[]> {
  const urls: string[] = [];
  for (const uri of localUris) {
    const url = await uploadImage(uri, `walks/${walkId}`);
    if (url) urls.push(url);
  }
  if (urls.length > 0) {
    await supabase
      .from("walk_photos")
      .insert(urls.map((url, i) => ({ walk_id: walkId, url, sort_order: i })));
  }
  return urls;
}

/** Mark a homework item as practiced — a repeatable log entry, not a one-off checkbox. */
export async function markHomeworkDone(dogId: string, reportCardItemId: string, walkId: string | null) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("homework_completions").insert({
    dog_id: dogId,
    report_card_item_id: reportCardItemId,
    walk_id: walkId,
    completed_by: user.id,
  });
}

/** This dog's current homework — the items on their most recent published report card. */
export async function getHomeworkForDog(dogId: string): Promise<HomeworkItem[]> {
  const { data: card } = await supabase
    .from("report_cards")
    .select("id")
    .eq("dog_id", dogId)
    .eq("status", "published")
    .order("session_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!card) return [];

  const { data: items } = await supabase
    .from("report_card_items")
    .select("id, drill_name, note, pillar, category")
    .eq("report_card_id", card.id)
    .order("sort_order");

  return (items ?? []).map((i) => ({
    id: i.id,
    drillName: i.drill_name,
    note: i.note ?? "",
    pillar: i.pillar,
    category: i.category,
  }));
}

/** Past, finished walks for a dog, newest first. */
export async function getWalks(dogId: string): Promise<Walk[]> {
  const { data } = await supabase
    .from("walks")
    .select(WALK_COLUMNS)
    .eq("dog_id", dogId)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false });

  return (data ?? []).map(mapWalk);
}

export type WalkDetail = {
  walk: Walk;
  route: LatLng[];
  photos: WalkPhoto[];
  homeworkDone: { id: string; drillName: string; completedAt: string }[];
};

/** Everything for one walk's detail screen — the row, its route, photos and homework marked off. */
export async function getWalkDetail(walkId: string): Promise<WalkDetail | null> {
  const [{ data: walkRow }, { data: points }, { data: photos }, { data: completions }] = await Promise.all([
    supabase.from("walks").select(WALK_COLUMNS).eq("id", walkId).single(),
    supabase.from("walk_points").select("lat, lng").eq("walk_id", walkId).order("sequence"),
    supabase.from("walk_photos").select("id, url").eq("walk_id", walkId).order("sort_order"),
    supabase
      .from("homework_completions")
      .select("id, completed_at, report_card_items(drill_name)")
      .eq("walk_id", walkId)
      .order("completed_at"),
  ]);

  if (!walkRow) return null;

  return {
    walk: mapWalk(walkRow),
    route: (points ?? []).map((p) => ({ lat: p.lat, lng: p.lng })),
    photos: (photos ?? []) as WalkPhoto[],
    homeworkDone: (completions ?? []).map((c) => ({
      id: c.id,
      drillName: (c.report_card_items as unknown as { drill_name: string } | null)?.drill_name ?? "",
      completedAt: c.completed_at,
    })),
  };
}

/** Share a finished walk to the community feed (with any photos), then link the post back to it. */
export async function shareWalkToCommunity(
  walk: Walk,
  dogName: string,
  photoUrls: string[]
): Promise<{ error: string | null }> {
  const mins = Math.round((walk.durationSeconds ?? 0) / 60);
  const label = walk.kind === "training" ? "training session" : "walk";
  const distanceKm = walk.distanceMeters ? (walk.distanceMeters / 1000).toFixed(1) : null;

  const lines = [`🐾 ${mins} min ${label} with ${dogName}${distanceKm ? ` · ${distanceKm} km` : ""}.`];
  if (walk.locationName.trim()) lines.push(`📍 ${walk.locationName.trim()}`);
  if (walk.notes.trim()) lines.push(walk.notes.trim());
  const body = lines.join("\n\n");

  const { error, postId } = await createPost(body, photoUrls);
  if (error) return { error };

  if (postId) {
    await supabase.from("walks").update({ shared_post_id: postId }).eq("id", walk.id);
  }

  return { error: null };
}
