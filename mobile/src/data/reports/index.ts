import { supabase } from "@/lib/supabase";

import { sampleDog } from "./sample";
import type { DogProfile, DogProgress, HomeworkCategory, ReportBundle, ReportCard, ReportComment, SkillPillar } from "./types";

export type { DogProfile, DogProgress, HomeworkCategory, ReportBundle, ReportCard, SkillPillar } from "./types";

/**
 * Report cards, homework days and skills — live from Supabase, the same
 * tables as the website (lib/reports/client.ts, lib/skills/store.ts). Row
 * Level Security decides what comes back: a member gets their own dogs'
 * published cards and skills; a trainer gets everything.
 */

export async function getDogProfile(): Promise<DogProfile> {
  // TODO(backend): the training plan, once the schedule is live.
  return sampleDog;
}

/** Homework counts as done once practised on this many separate days… */
export const HOMEWORK_TARGET_DAYS = 3;
/** …within this many days of the card. */
export const HOMEWORK_WINDOW_DAYS = 14;

/** Today in the UK (YYYY-MM-DD), the day "I practised today" is logged for. */
export function todayUK(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

/** Still inside the 14 days to log homework? */
export function windowOpen(card: ReportCard, today = todayUK()): boolean {
  const end = new Date(`${card.date.slice(0, 10)}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + HOMEWORK_WINDOW_DAYS);
  return today <= end.toISOString().slice(0, 10);
}

type ItemRow = { id: string; pillar: string | null; category: string | null; drill_name: string; drill_ref: string | null; sort_order: number };
type CardRow = {
  id: string;
  dog_id: string;
  session_date: string | null;
  title: string | null;
  summary: string | null;
  wins: string[] | null;
  created_at: string;
  seen_at: string | null;
  dogs: { name: string; photo_url: string | null } | { name: string; photo_url: string | null }[] | null;
  report_card_items: ItemRow[] | null;
  report_card_comments: { id: string; author_role: "owner" | "staff"; author_name: string | null; body: string; created_at: string }[] | null;
};

function toHomework(items: ItemRow[]): HomeworkCategory[] {
  const out: HomeworkCategory[] = [];
  const byName = new Map<string, HomeworkCategory>();
  for (const it of [...items].sort((a, b) => a.sort_order - b.sort_order)) {
    const name = (it.category ?? "").trim() || "Homework";
    let cat = byName.get(name.toLowerCase());
    if (!cat) {
      cat = { id: `${it.id}-cat`, name, drills: [] };
      byName.set(name.toLowerCase(), cat);
      out.push(cat);
    }
    cat.drills.push({ id: it.id, name: it.drill_name, ref: it.drill_ref, pillar: it.pillar });
  }
  return out;
}

function toCard(r: CardRow): ReportCard {
  const dog = Array.isArray(r.dogs) ? r.dogs[0] : r.dogs;
  const homework = toHomework(r.report_card_items ?? []);
  const comments: ReportComment[] = [...(r.report_card_comments ?? [])]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((c) => ({ id: c.id, author: c.author_role, authorName: c.author_name || (c.author_role === "staff" ? "Nelly & Nova" : "You"), body: c.body, createdAt: c.created_at }));
  return {
    id: r.id,
    dogId: r.dog_id,
    dogName: dog?.name,
    dogPhoto: dog?.photo_url ?? null,
    date: r.session_date ? `${r.session_date}T12:00:00Z` : r.created_at,
    focus: r.title?.trim() || homework.map((c) => c.name).join(" · ") || "Training session",
    summary: r.summary ?? "",
    wins: (r.wins ?? []).filter((w) => w.trim()),
    homework,
    comments,
    isNew: !r.seen_at,
  };
}

/** A member's published report cards (newest first) and the days each was practised. */
export async function getReportCards(): Promise<ReportBundle> {
  const [cardsRes, doneRes] = await Promise.all([
    supabase
      .from("report_cards")
      .select(
        "id, dog_id, session_date, title, summary, wins, created_at, seen_at, dogs(name, photo_url), report_card_items(id, pillar, category, drill_name, drill_ref, sort_order), report_card_comments(id, author_role, author_name, body, created_at)"
      )
      .eq("status", "published")
      .order("session_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("homework_completions").select("report_card_item_id, practised_on").limit(2000),
  ]);
  if (cardsRes.error) throw cardsRes.error;
  const rows = (cardsRes.data ?? []) as unknown as CardRow[];
  const itemToCard = new Map<string, string>();
  for (const r of rows) for (const it of r.report_card_items ?? []) itemToCard.set(it.id, r.id);
  const sets: Record<string, Set<string>> = {};
  for (const d of (doneRes.data ?? []) as { report_card_item_id: string; practised_on: string }[]) {
    const card = itemToCard.get(d.report_card_item_id);
    if (card) (sets[card] ??= new Set()).add(d.practised_on);
  }
  const progress: Record<string, string[]> = {};
  for (const [id, set] of Object.entries(sets)) progress[id] = [...set].sort();
  return { cards: rows.map(toCard), progress };
}

/** "I practised today" for a card: a homework_completions row per drill, once a day. */
export async function logHomeworkDay(card: ReportCard, day = todayUK()): Promise<void> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Please sign in again.");
  const items = card.homework.flatMap((c) => c.drills.map((d) => d.id));
  if (!card.dogId || items.length === 0) return;
  const { error } = await supabase.from("homework_completions").upsert(
    items.map((id) => ({ dog_id: card.dogId, report_card_item_id: id, completed_by: data.user!.id, practised_on: day })),
    { onConflict: "report_card_item_id,practised_on", ignoreDuplicates: true }
  );
  if (error) throw error;
}

/** Clear the "new" mark on cards the member has now opened. */
export async function markReportsSeen(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.rpc("mark_report_cards_seen", { p_ids: ids });
  if (error) console.warn("markReportsSeen", error.message);
}

/** A question about the homework, on a card (only the member and the trainers see it). */
export async function askAboutHomework(cardId: string, body: string, authorName: string): Promise<void> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Please sign in again.");
  const { error } = await supabase
    .from("report_card_comments")
    .insert({ report_card_id: cardId, author_id: data.user.id, author_role: "owner", author_name: authorName, body: body.trim().slice(0, 2000) });
  if (error) throw error;
}

// --- Skills & levels -----------------------------------------------------------

const PILLARS = [
  { id: "engagement", name: "Engagement", blurb: "Does my dog want to train with me?" },
  { id: "skills", name: "Skills", blurb: "Can my dog do what I ask?" },
  { id: "mindset", name: "Mindset", blurb: "How does my dog cope outside of training?" },
];

/** The skills checklist, by pillar and level. */
export async function getSkillPillars(): Promise<SkillPillar[]> {
  const { data, error } = await supabase.from("skills").select("id, pillar, name, level, sort_order");
  if (error) throw error;
  const rows = (data ?? []) as { id: string; pillar: string; name: string; level: number; sort_order: number }[];
  return PILLARS.map((p) => ({
    ...p,
    skills: rows
      .filter((r) => r.pillar === p.id)
      .sort((a, b) => a.level - b.level || a.sort_order - b.sort_order)
      .map((r) => ({ id: r.id, name: r.name, level: r.level })),
  }));
}

/** A dog's skills: which are learnt (and when). */
export async function getDogProgress(dogId: string): Promise<DogProgress> {
  const [pillars, res] = await Promise.all([getSkillPillars(), supabase.from("dog_skills").select("skill_id, learnt_at").eq("dog_id", dogId)]);
  if (res.error) throw res.error;
  const learnt: Record<string, string> = {};
  for (const r of (res.data ?? []) as { skill_id: string; learnt_at: string }[]) learnt[r.skill_id] = r.learnt_at;
  return { dogId, pillars, learnt };
}

/**
 * A pillar's level: everyone starts on Level 1, and finishing every skill
 * at their level moves them up (same rule as the website's config/skills.ts).
 */
export function pillarLevel(pillar: SkillPillar, learnt: Record<string, string>): number {
  let level = 1;
  for (const lvl of [...new Set(pillar.skills.map((s) => s.level))].sort((a, b) => a - b)) {
    if (!pillar.skills.filter((s) => s.level === lvl).every((s) => learnt[s.id])) break;
    level = lvl + 1;
  }
  return level;
}

/** Trainer: tick skills on or off for a dog (`changes`: skill id → learnt). */
export async function saveDogSkills(dogId: string, changes: Record<string, boolean>): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const on = Object.keys(changes).filter((k) => changes[k]);
  const off = Object.keys(changes).filter((k) => !changes[k]);
  if (on.length) {
    const { error } = await supabase
      .from("dog_skills")
      .upsert(on.map((skill_id) => ({ dog_id: dogId, skill_id, marked_by: data.user?.id ?? null })), { onConflict: "dog_id,skill_id", ignoreDuplicates: true });
    if (error) throw error;
  }
  if (off.length) {
    const { error } = await supabase.from("dog_skills").delete().eq("dog_id", dogId).in("skill_id", off);
    if (error) throw error;
  }
}
