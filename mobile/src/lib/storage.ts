/**
 * Uploads to the real Supabase Storage `media` bucket (public read, writes
 * scoped to the uploader's own folder — see the "walk_tracker_strava"
 * migration). Used for walk photos now; community post images and dog
 * avatars can reuse this once those upload flows exist.
 */
import { supabase } from "@/lib/supabase";

/** Uploads a local file (from the image picker/camera) and returns its public URL. */
export async function uploadImage(localUri: string, folder: string): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const extMatch = /\.(\w+)$/.exec(localUri);
  const ext = extMatch?.[1]?.toLowerCase() ?? "jpg";
  const path = `${user.id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const response = await fetch(localUri);
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from("media")
    .upload(path, blob, { contentType: blob.type || `image/${ext}`, upsert: false });
  if (error) return null;

  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}
