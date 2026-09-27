import { supabase } from "@/lib/supabase";

export type Dog = { id: string; name: string; photoUrl: string | null };

/** Live: the signed-in account's dogs (same query as the website's lib/auth/session.ts). */
export async function getMyDogs(userId: string): Promise<Dog[]> {
  const { data, error } = await supabase.from("dogs").select("id, name, photo_url").eq("account_id", userId).order("sort_order");
  if (error) throw error;
  return (data ?? []).map((d) => ({ id: d.id as string, name: d.name as string, photoUrl: (d.photo_url as string | null) ?? null }));
}
