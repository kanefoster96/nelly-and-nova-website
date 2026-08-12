/**
 * Dog-photo storage seam.
 * -----------------------
 * The photo the owner picks (a data URL) becomes their account picture. Until
 * Supabase Storage is wired up this just returns the data URL so the scaffold
 * keeps working; once the backend is live, swap the body for the upload below.
 */
import { createClient } from "@/lib/supabase/client";

/** Key used to hand a chosen photo from the booking form to create-account. */
export const DOG_PHOTO_HANDOFF_KEY = "nn-dog-photo";

/** Key used to hand any additional dogs from the booking form to create-account. */
export const EXTRA_DOGS_HANDOFF_KEY = "nn-extra-dogs";

/**
 * Upload a dog photo and return its public URL.
 * @param dataUrl a `data:` URL from AvatarUpload
 * @param ownerId the account/user id, used to namespace the storage path
 */
export async function uploadDogPhoto(
  dataUrl: string,
  ownerId: string
): Promise<string> {
  // Not configured yet — keep the local data URL so previews still work.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return dataUrl;

  // TODO(backend): create a public `dog-photos` bucket in Supabase Storage,
  // then enable this. Path is namespaced by owner so RLS can scope writes.
  //
  // const supabase = createClient();
  // const blob = await (await fetch(dataUrl)).blob();
  // const path = `${ownerId}/${crypto.randomUUID()}`;
  // const { error } = await supabase.storage
  //   .from("dog-photos")
  //   .upload(path, blob, { contentType: blob.type, upsert: true });
  // if (error) throw error;
  // return supabase.storage.from("dog-photos").getPublicUrl(path).data.publicUrl;

  void createClient; // referenced above once enabled
  void ownerId;
  return dataUrl;
}
