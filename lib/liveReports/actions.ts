"use server";

import { createClient } from "@/lib/supabase/server";
import { notifyMember } from "@/lib/push/notify";

export type NewReportCardItem = { drillName: string; note: string };

export async function createDraftReportCard(input: {
  dogId: string;
  title: string;
  sessionDate: string;
  summary: string;
  items: NewReportCardItem[];
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: card, error } = await supabase
    .from("report_cards")
    .insert({
      dog_id: input.dogId,
      author_id: user.id,
      status: "draft",
      title: input.title.trim() || "Session homework",
      session_date: input.sessionDate || null,
      summary: input.summary.trim() || null,
    })
    .select("id")
    .single();
  if (error || !card) return { error: error?.message ?? "Failed to create report card." };

  const items = input.items
    .map((i) => ({ drillName: i.drillName.trim(), note: i.note.trim() }))
    .filter((i) => i.drillName)
    .map((i, index) => ({
      report_card_id: card.id,
      drill_name: i.drillName,
      note: i.note || null,
      sort_order: index,
    }));

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("report_card_items").insert(items);
    if (itemsError) return { error: itemsError.message };
  }

  return { error: null };
}

export async function publishReportCard(reportCardId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data: card } = await supabase
    .from("report_cards")
    .select("dog_id, title, dogs(name, account_id)")
    .eq("id", reportCardId)
    .single();

  const { error } = await supabase
    .from("report_cards")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", reportCardId);
  if (error) return { error: error.message };

  const dog = card?.dogs ? (Array.isArray(card.dogs) ? card.dogs[0] : card.dogs) : null;
  if (dog?.account_id) {
    await notifyMember({
      accountId: dog.account_id,
      kind: "report_card_published",
      title: "New report card",
      body: `${dog.name}'s ${card?.title || "session"} report card is ready — check the Homework tab.`,
    });
  }

  return { error: null };
}
