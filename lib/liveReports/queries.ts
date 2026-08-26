import { createClient } from "@/lib/supabase/server";

export type DraftReportCard = {
  id: string;
  dogName: string;
  ownerName: string;
  title: string;
  sessionDate: string | null;
  itemCount: number;
  createdAt: string;
};

type Row = {
  id: string;
  title: string | null;
  session_date: string | null;
  created_at: string;
  dogs: { name: string; profiles: { owner_name: string | null } | { owner_name: string | null }[] | null } | { name: string; profiles: { owner_name: string | null } | { owner_name: string | null }[] | null }[] | null;
  report_card_items: { id: string }[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function getDraftReportCards(): Promise<DraftReportCard[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("report_cards")
    .select("id, title, session_date, created_at, dogs(name, profiles(owner_name)), report_card_items(id)")
    .eq("status", "draft")
    .order("created_at", { ascending: false });

  return ((data ?? []) as Row[]).map((r) => {
    const dog = one(r.dogs);
    return {
      id: r.id,
      dogName: dog?.name || "Dog",
      ownerName: one(dog?.profiles ?? null)?.owner_name || "Member",
      title: r.title || "Session homework",
      sessionDate: r.session_date,
      itemCount: r.report_card_items?.length ?? 0,
      createdAt: r.created_at,
    };
  });
}
