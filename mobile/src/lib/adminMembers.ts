/**
 * Real customer/dog browser for the Admin menu tab — same `profiles`/`dogs`
 * tables as everywhere else, admin-readable via RLS.
 */
import { supabase } from "@/lib/supabase";

export type MemberDog = { id: string; name: string; breed: string; photoUrl: string };
export type Member = { accountId: string; ownerName: string; email: string; phone: string; dogs: MemberDog[] };

export async function getAllMembers(): Promise<Member[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id, owner_name, email, phone, dogs(id, name, breed, photo_url)")
    .eq("role", "member")
    .order("owner_name");

  return (data ?? []).map((p) => ({
    accountId: p.id,
    ownerName: p.owner_name || "Member",
    email: p.email ?? "",
    phone: p.phone ?? "",
    dogs: (p.dogs ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      breed: d.breed ?? "",
      photoUrl: d.photo_url ?? "",
    })),
  }));
}
