import { supabase } from "@/lib/supabase";

/**
 * Trainer: the team, as the website's /admin/team (components/admin/
 * TeamManager.tsx): every trainer (profiles.role = 'admin') with the
 * display name and photo shown on their chat messages and community posts.
 * Any trainer can change any trainer's, as there: profiles' own Row Level
 * Security lets trainers update any profile, and the photo goes in the
 * public `media` bucket under the signed-in trainer's folder, the same
 * path the website uses.
 */

export type Trainer = { id: string; name: string | null; email: string | null; avatarUrl: string | null };

export async function listTeam(): Promise<Trainer[]> {
  const { data, error } = await supabase.from("profiles").select("id, owner_name, email, avatar_url").eq("role", "admin").order("owner_name");
  if (error) throw new Error("Couldn't load the team.");
  return ((data ?? []) as { id: string; owner_name: string | null; email: string | null; avatar_url: string | null }[]).map((t) => ({
    id: t.id,
    name: t.owner_name,
    email: t.email,
    avatarUrl: t.avatar_url,
  }));
}

export async function saveTrainerName(id: string, name: string): Promise<void> {
  const { error } = await supabase.from("profiles").update({ owner_name: name.trim() || null }).eq("id", id);
  if (error) throw new Error("Couldn't save the name.");
}

/** A picked (square-cropped) photo → media/<me>/team-<id>-<time>.jpg → their avatar. Returns its URL. */
export async function saveTrainerPhoto(id: string, photo: { uri: string; mimeType?: string | null }): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const me = data.session?.user.id;
  if (!me) throw new Error("Please sign in again.");
  const type = photo.mimeType || "image/jpeg";
  const ext = type === "image/png" ? "png" : "jpg";
  const path = `${me}/team-${id}-${Date.now()}.${ext}`;
  // fetch() reads the local file without another native module (as community posts upload).
  const bytes = await (await fetch(photo.uri)).arrayBuffer();
  const { error } = await supabase.storage.from("media").upload(path, bytes, { contentType: type, upsert: true });
  if (error) throw new Error("Couldn't upload that photo.");
  const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
  const { error: saveError } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", id);
  if (saveError) throw new Error("Couldn't save the photo.");
  return url;
}
