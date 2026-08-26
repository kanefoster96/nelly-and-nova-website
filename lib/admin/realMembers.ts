/**
 * Real member lookup for the new real-data admin pages (chat, reschedule
 * requests, report cards) — reads the actual `profiles`/`dogs` tables the
 * mobile app uses, not the legacy schedule-board sample data the rest of
 * the website admin area still runs on.
 */
import { createClient } from "@/lib/supabase/server";

export type RealMemberDog = { id: string; name: string };
export type RealMember = { accountId: string; ownerName: string; dogs: RealMemberDog[] };

export async function getRealMembers(): Promise<RealMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, owner_name, dogs(id, name)")
    .eq("role", "member")
    .order("owner_name");

  return (data ?? []).map((p) => ({
    accountId: p.id,
    ownerName: p.owner_name ?? "Member",
    dogs: (p.dogs ?? []) as RealMemberDog[],
  }));
}
