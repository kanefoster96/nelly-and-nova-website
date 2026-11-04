import { todayLondon } from "@/data/sessions";
import { postToSite } from "@/lib/site-api";
import { supabase } from "@/lib/supabase";

/**
 * Photos from a dog's day with us. Trainers add them from the dog's page
 * (components/day-photos/add-day-photo.tsx); owners see their own dogs' on
 * the Profile tab (components/day-photos/day-photos.tsx). Files are in the
 * private "day-photos" bucket at <dog id>/<YYYY-MM-DD>/<name>.jpg with a
 * day_photos row each, shown through short-lived signed links. Row Level
 * Security: trainers add, read and delete; owners read their own dogs' only.
 * Kept 90 days. See supabase/migrations/20261104110000_owner_flow.sql in
 * the website repo.
 */
export const DAY_PHOTO_BUCKET = "day-photos";

export type DayPhoto = {
  id: string;
  dogId: string;
  takenOn: string; // YYYY-MM-DD (UK)
  path: string;
  url: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
};

type Row = { id: string; dog_id: string; taken_on: string; path: string; width: number | null; height: number | null; created_at: string };

/** A dog's photos, newest first (just one day's with `on`). */
export async function getDayPhotos(dogId: string, opts: { on?: string; limit?: number } = {}): Promise<DayPhoto[]> {
  let q = supabase
    .from("day_photos")
    .select("id, dog_id, taken_on, path, width, height, created_at")
    .eq("dog_id", dogId)
    .order("taken_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 300);
  if (opts.on) q = q.eq("taken_on", opts.on);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return [];
  const { data: signed } = await supabase.storage.from(DAY_PHOTO_BUCKET).createSignedUrls(
    rows.map((r) => r.path),
    60 * 60,
  );
  const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({
    id: r.id,
    dogId: r.dog_id,
    takenOn: r.taken_on,
    path: r.path,
    url: urls.get(r.path) ?? null,
    width: r.width,
    height: r.height,
    createdAt: r.created_at,
  }));
}

/** Photos by day, newest day first. */
export function byDay(photos: DayPhoto[]): { date: string; photos: DayPhoto[] }[] {
  const out: { date: string; photos: DayPhoto[] }[] = [];
  for (const p of photos) {
    const last = out[out.length - 1];
    if (last?.date === p.takenOn) last.photos.push(p);
    else out.push({ date: p.takenOn, photos: [p] });
  }
  return out;
}

/** "Today", "Yesterday", "Mon 3 Nov". */
export function dayHeading(date: string, today = todayLondon()): string {
  if (date === today) return "Today";
  const y = new Date(`${today}T12:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  if (date === y.toISOString().slice(0, 10)) return "Yesterday";
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
}

export type PickedPhoto = { uri: string; width?: number | null; height?: number | null; mimeType?: string | null };

function extension(mime: string | null | undefined): { ext: string; type: string } {
  if (mime === "image/png") return { ext: "png", type: mime };
  if (mime === "image/heic") return { ext: "heic", type: mime };
  if (mime === "image/webp") return { ext: "webp", type: mime };
  return { ext: "jpg", type: "image/jpeg" };
}

const randomName = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Trainer: upload photos to a dog's day (one at a time, so a weak signal
 * still gets most of them through), then ask the website to tell the owner
 * ("📸 New photos of Bella", once per dog per day). Resolves to how many
 * went up.
 */
export async function addDayPhotos(dogId: string, photos: PickedPhoto[], onProgress?: (done: number, total: number) => void): Promise<number> {
  const day = todayLondon();
  let added = 0;
  for (const [i, p] of photos.entries()) {
    onProgress?.(i, photos.length);
    try {
      const { ext, type } = extension(p.mimeType);
      const path = `${dogId}/${day}/${randomName()}.${ext}`;
      const bytes = await (await fetch(p.uri)).arrayBuffer();
      const { error: upErr } = await supabase.storage.from(DAY_PHOTO_BUCKET).upload(path, bytes, { contentType: type });
      if (upErr) continue;
      const { error } = await supabase.from("day_photos").insert({
        dog_id: dogId,
        taken_on: day,
        path,
        width: p.width ? Math.round(p.width) : null,
        height: p.height ? Math.round(p.height) : null,
      });
      if (error) {
        void supabase.storage.from(DAY_PHOTO_BUCKET).remove([path]);
        continue;
      }
      added++;
    } catch {
      // This one didn't go: carry on with the rest.
    }
  }
  onProgress?.(photos.length, photos.length);
  if (added > 0) {
    await postToSite("/api/day-photos/notify", { dogId }, "Couldn't tell the owner.").catch(() => undefined);
  }
  return added;
}

/** Trainer: take a photo off a dog's day. */
export async function deleteDayPhoto(photo: DayPhoto): Promise<void> {
  const { error } = await supabase.from("day_photos").delete().eq("id", photo.id);
  if (error) throw new Error("Couldn't delete that photo.");
  await supabase.storage.from(DAY_PHOTO_BUCKET).remove([photo.path]);
}
