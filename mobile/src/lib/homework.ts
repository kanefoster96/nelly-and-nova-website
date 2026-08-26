/**
 * Report cards + homework — real `report_cards`/`report_card_items` tables.
 * A dog only ever sees *published* cards (RLS: `report_cards: select
 * published-own or admin`). Every published card's items count as homework
 * the owner has "unlocked" — they keep access to all of it, not just the
 * latest week — with `homework_completions` logging every time an item is
 * marked practiced (a repeatable log, not a one-off checkbox, since the
 * same drill gets practised across many sessions).
 */
import { supabase } from "@/lib/supabase";

export type HomeworkItem = {
  id: string;
  drillName: string;
  note: string;
  pillar: string | null;
  category: string | null;
};

export type ReportCard = {
  id: string;
  sessionDate: string | null;
  title: string;
  summary: string;
  publishedAt: string | null;
  items: HomeworkItem[];
};

type ReportCardRow = {
  id: string;
  session_date: string | null;
  title: string | null;
  summary: string | null;
  published_at: string | null;
  report_card_items: {
    id: string;
    drill_name: string;
    note: string | null;
    pillar: string | null;
    category: string | null;
    sort_order: number;
  }[];
};

function mapCard(row: ReportCardRow): ReportCard {
  return {
    id: row.id,
    sessionDate: row.session_date,
    title: row.title ?? "",
    summary: row.summary ?? "",
    publishedAt: row.published_at,
    items: (row.report_card_items ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({ id: i.id, drillName: i.drill_name, note: i.note ?? "", pillar: i.pillar, category: i.category })),
  };
}

/** Every published report card for this dog, newest first — the homework library. */
export async function getHomeworkLibrary(dogId: string): Promise<ReportCard[]> {
  const { data } = await supabase
    .from("report_cards")
    .select("id, session_date, title, summary, published_at, report_card_items(id, drill_name, note, pillar, category, sort_order)")
    .eq("dog_id", dogId)
    .eq("status", "published")
    .order("session_date", { ascending: false });

  return ((data ?? []) as ReportCardRow[]).map(mapCard);
}

/** Just the most recent published card — for the preview on the dog's profile. */
export async function getLatestReportCard(dogId: string): Promise<ReportCard | null> {
  const { data } = await supabase
    .from("report_cards")
    .select("id, session_date, title, summary, published_at, report_card_items(id, drill_name, note, pillar, category, sort_order)")
    .eq("dog_id", dogId)
    .eq("status", "published")
    .order("session_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? mapCard(data as ReportCardRow) : null;
}

/** Which homework items this dog has ever been marked as having practiced. */
export async function getCompletedItemIds(dogId: string): Promise<Set<string>> {
  const { data } = await supabase.from("homework_completions").select("report_card_item_id").eq("dog_id", dogId);
  return new Set((data ?? []).map((d) => d.report_card_item_id as string));
}

/** Mark a homework item as practiced — logs a new completion, doesn't just flip a flag. */
export async function markHomeworkDone(dogId: string, reportCardItemId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("homework_completions").insert({
    dog_id: dogId,
    report_card_item_id: reportCardItemId,
    completed_by: user.id,
  });
}
