import { postToSite } from "@/lib/site-api";
import { supabase } from "@/lib/supabase";

import { HOMEWORK_TARGET_DAYS } from "./reports";

/**
 * Trainer: a dog's report cards and homework, written the same way as the
 * website's (lib/reports/client.ts saveDraftCard / saveCardHomework /
 * publishCards): a report_cards row (a draft owners can't see, until it's
 * sent) with its homework as report_card_items — categories, each with
 * drills, picked from the drill library (drill_ref, pillar) or typed.
 * Sending goes through the website's /api/reports/publish, which marks it
 * published and emails and notifies the owner.
 */

export type EditDrill = { id?: string; name: string; ref?: string | null; pillar?: string | null };
export type EditCategory = { name: string; drills: EditDrill[] };

export type TrainerCard = {
  id: string;
  dogId: string;
  status: "draft" | "published";
  /** YYYY-MM-DD. */
  date: string;
  title: string;
  summary: string;
  wins: string[];
  strength: string;
  toImprove: string;
  homework: EditCategory[];
  /** Separate days the homework's been practised. */
  practisedDays: number;
  comments: number;
};

type ItemRow = { id: string; pillar: string | null; category: string | null; drill_name: string; drill_ref: string | null; sort_order: number };
type CardRow = {
  id: string;
  dog_id: string;
  status: "draft" | "published";
  session_date: string | null;
  title: string | null;
  summary: string | null;
  wins: string[] | null;
  strength: string | null;
  to_improve: string | null;
  created_at: string;
  report_card_items: ItemRow[] | null;
  report_card_comments: { id: string }[] | null;
};

const CARD_COLUMNS =
  "id, dog_id, status, session_date, title, summary, wins, strength, to_improve, created_at, report_card_items(id, pillar, category, drill_name, drill_ref, sort_order), report_card_comments(id)";

function toHomework(items: ItemRow[]): EditCategory[] {
  const out: EditCategory[] = [];
  const byName = new Map<string, EditCategory>();
  for (const it of [...items].sort((a, b) => a.sort_order - b.sort_order)) {
    const name = (it.category ?? "").trim() || "Homework";
    let cat = byName.get(name.toLowerCase());
    if (!cat) {
      cat = { name, drills: [] };
      byName.set(name.toLowerCase(), cat);
      out.push(cat);
    }
    cat.drills.push({ id: it.id, name: it.drill_name, ref: it.drill_ref, pillar: it.pillar });
  }
  return out;
}

function toCard(r: CardRow, days: Record<string, Set<string>>): TrainerCard {
  const homework = toHomework(r.report_card_items ?? []);
  return {
    id: r.id,
    dogId: r.dog_id,
    status: r.status,
    date: (r.session_date ?? r.created_at).slice(0, 10),
    title: r.title?.trim() || homework.map((c) => c.name).join(" · ") || "Training session",
    summary: r.summary ?? "",
    wins: (r.wins ?? []).filter((w) => w.trim()),
    strength: r.strength ?? "",
    toImprove: r.to_improve ?? "",
    homework,
    practisedDays: days[r.id]?.size ?? 0,
    comments: (r.report_card_comments ?? []).length,
  };
}

async function practiceDays(rows: CardRow[]): Promise<Record<string, Set<string>>> {
  const itemToCard = new Map<string, string>();
  for (const r of rows) for (const it of r.report_card_items ?? []) itemToCard.set(it.id, r.id);
  if (itemToCard.size === 0) return {};
  const { data } = await supabase.from("homework_completions").select("report_card_item_id, practised_on").in("report_card_item_id", [...itemToCard.keys()]).limit(2000);
  const out: Record<string, Set<string>> = {};
  for (const d of (data ?? []) as { report_card_item_id: string; practised_on: string }[]) {
    const card = itemToCard.get(d.report_card_item_id);
    if (card) (out[card] ??= new Set()).add(d.practised_on);
  }
  return out;
}

/** A dog's cards, drafts and sent, newest first. */
export async function getDogCards(dogId: string, limit = 10): Promise<TrainerCard[]> {
  const { data, error } = await supabase
    .from("report_cards")
    .select(CARD_COLUMNS)
    .eq("dog_id", dogId)
    .order("session_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as CardRow[];
  const days = await practiceDays(rows);
  return rows.map((r) => toCard(r, days));
}

export async function getCard(id: string): Promise<TrainerCard | null> {
  const { data, error } = await supabase.from("report_cards").select(CARD_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as unknown as CardRow;
  return toCard(row, await practiceDays([row]));
}

/** The dog's draft for a session date, to carry on with. */
export async function findDraft(dogId: string, date: string): Promise<TrainerCard | null> {
  const { data } = await supabase.from("report_cards").select("id").eq("dog_id", dogId).eq("session_date", date).eq("status", "draft").limit(1).maybeSingle();
  return data ? getCard((data as { id: string }).id) : null;
}

export function homeworkTitle(homework: EditCategory[]): string {
  return homework.map((c) => c.name.trim()).filter(Boolean).join(" · ");
}

export function drillCount(homework: EditCategory[]): number {
  return homework.filter((c) => c.name.trim()).reduce((n, c) => n + c.drills.length, 0);
}

export function homeworkDone(card: Pick<TrainerCard, "practisedDays">): boolean {
  return card.practisedDays >= HOMEWORK_TARGET_DAYS;
}

/** Replace a card's items, keeping the ids of drills that stay (and so their practice days). */
async function writeItems(cardId: string, homework: EditCategory[]): Promise<void> {
  const { data: existing, error: readErr } = await supabase.from("report_card_items").select("id").eq("report_card_id", cardId);
  if (readErr) throw new Error("Couldn't save the homework.");
  const have = new Set(((existing ?? []) as { id: string }[]).map((e) => e.id));
  const keep = new Set<string>();
  const rows: Record<string, unknown>[] = [];
  let order = 0;
  for (const cat of homework) {
    const category = cat.name.trim();
    if (!category) continue;
    cat.drills.forEach((d, i) => {
      const row: Record<string, unknown> = {
        report_card_id: cardId,
        category,
        drill_name: d.name.trim() || `Drill ${i + 1}`,
        drill_ref: d.ref ?? null,
        pillar: d.pillar ?? null,
        sort_order: order++,
      };
      if (d.id && have.has(d.id)) {
        row.id = d.id;
        keep.add(d.id);
      }
      rows.push(row);
    });
  }
  const gone = [...have].filter((id) => !keep.has(id));
  if (gone.length) {
    const { error } = await supabase.from("report_card_items").delete().in("id", gone);
    if (error) throw new Error("Couldn't save the homework.");
  }
  for (const u of rows.filter((r) => r.id)) {
    const { id, ...patch } = u;
    const { error } = await supabase.from("report_card_items").update(patch).eq("id", id as string);
    if (error) throw new Error("Couldn't save the homework.");
  }
  const inserts = rows.filter((r) => !r.id);
  if (inserts.length) {
    const { error } = await supabase.from("report_card_items").insert(inserts);
    if (error) throw new Error("Couldn't save the homework.");
  }
}

export type CardDraft = {
  dogId: string;
  date: string;
  summary: string;
  wins: string[];
  strength: string;
  toImprove: string;
  homework: EditCategory[];
};

/** Save as a draft (owners can't see drafts): creates it, or updates `cardId`. Returns the card id. */
export async function saveDraftCard(d: CardDraft, cardId?: string | null): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Please sign in again.");
  const fields = {
    title: homeworkTitle(d.homework) || null,
    summary: d.summary.trim() || null,
    wins: d.wins.map((w) => w.trim()).filter(Boolean),
    strength: d.strength.trim().slice(0, 200) || null,
    to_improve: d.toImprove.trim().slice(0, 200) || null,
    session_date: d.date,
  };
  let id = cardId ?? null;
  if (id) {
    const { error } = await supabase.from("report_cards").update(fields).eq("id", id);
    if (error) throw new Error("Couldn't save the report card.");
  } else {
    const { data, error } = await supabase
      .from("report_cards")
      .insert({ ...fields, dog_id: d.dogId, author_id: auth.user.id, status: "draft" })
      .select("id")
      .single();
    if (error || !data) throw new Error("Couldn't save the report card.");
    id = (data as { id: string }).id;
  }
  await writeItems(id, d.homework);
  return id;
}

/** Revise the homework on a card that's already been sent (the owner sees it straight away). */
export async function saveCardHomework(cardId: string, homework: EditCategory[]): Promise<void> {
  const { error } = await supabase.from("report_cards").update({ title: homeworkTitle(homework) || null }).eq("id", cardId);
  if (error) throw new Error("Couldn't save the homework.");
  await writeItems(cardId, homework);
}

/** Send drafts to their owners: email and an app notification each (the website does it). */
export async function publishCards(ids: string[]): Promise<{ published: number; notified: number }> {
  const res = await postToSite<{ published?: number; notified?: number }>("/api/reports/publish", { ids }, "Couldn't send the report card.");
  return { published: res.published ?? 0, notified: res.notified ?? 0 };
}

export async function deleteCard(id: string): Promise<void> {
  const { error } = await supabase.from("report_cards").delete().eq("id", id);
  if (error) throw new Error("Couldn't delete it.");
}
