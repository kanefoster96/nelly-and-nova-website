"use client";

/**
 * Report cards, homework days and resets — live from Supabase.
 * -------------------------------------------------------------
 * One shared store for every screen that shows report cards (the owner's
 * cards, the Homework flow, Practice, the profile's completion stat, the
 * header badge, and the trainer's lists). Row Level Security decides what's
 * in it: an owner gets their own dogs' published cards; a trainer gets every
 * card, drafts included.
 *
 *   report_cards          a card (title, summary, wins, status, seen_at)
 *   report_card_items     its homework, one row per drill, grouped by category
 *   report_card_comments  questions about the homework (owner + trainers)
 *   homework_completions  "I practised today": a row per item per day
 *   homework_resets       a trainer's "reset to 100%" per dog
 *
 * Writes are optimistic where the owner is waiting on them (practised today,
 * seen) and then reload. Every write throws a friendly Error on failure.
 */
import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import type { HomeworkCategory, ReportCard, ReportComment } from "./types";

type Progress = Record<string, string[]>; // cardId → YYYY-MM-DD days practised
type Resets = Record<string, string>; // dogId → reset_at

export type ReportsState = {
  loaded: boolean;
  error: string | null;
  /** Whether the signed-in account is a trainer (sees drafts, no "new" badges). */
  staff: boolean;
  cards: ReportCard[];
  progress: Progress;
  resets: Resets;
};

const EMPTY: ReportsState = { loaded: false, error: null, staff: false, cards: [], progress: {}, resets: {} };
let state: ReportsState = EMPTY;
const listeners = new Set<() => void>();
let started = false;
let loading: Promise<void> | null = null;

function sb() {
  return createClient();
}

function emit(next: ReportsState) {
  state = next;
  for (const l of listeners) l();
}

function friendly(what: string, error: { message?: string } | null): Error {
  const msg = error?.message ?? "";
  if (/row-level security|permission denied/i.test(msg)) return new Error(`${what}: you don't have permission to do that.`);
  if (/fetch|network/i.test(msg)) return new Error(`${what}: we couldn't reach the server. Please try again.`);
  return new Error(`${what}. ${msg || "Please try again."}`.trim());
}

const CARD_COLUMNS =
  "id, dog_id, status, session_date, title, summary, wins, strength, to_improve, created_at, published_at, seen_at, " +
  "dogs(name, photo_url), " +
  "report_card_items(id, pillar, category, drill_name, drill_ref, sort_order), " +
  "report_card_comments(id, author_role, author_name, body, created_at)";

type ItemRow = { id: string; pillar: string | null; category: string | null; drill_name: string; drill_ref: string | null; sort_order: number };
type CommentRow = { id: string; author_role: "owner" | "staff"; author_name: string | null; body: string; created_at: string };
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
  published_at: string | null;
  seen_at: string | null;
  dogs: { name: string; photo_url: string | null } | { name: string; photo_url: string | null }[] | null;
  report_card_items: ItemRow[] | null;
  report_card_comments: CommentRow[] | null;
};

/** Items → categories (in the order the trainer wrote them), each with its drills. */
export function itemsToHomework(items: ItemRow[]): HomeworkCategory[] {
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

function toCard(r: CardRow, staff: boolean): ReportCard {
  const dog = Array.isArray(r.dogs) ? r.dogs[0] : r.dogs;
  const homework = itemsToHomework(r.report_card_items ?? []);
  const comments: ReportComment[] = [...(r.report_card_comments ?? [])]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((c) => ({
      id: c.id,
      author: c.author_role,
      authorName: c.author_name || (c.author_role === "staff" ? "Nelly & Nova" : "Owner"),
      body: c.body,
      createdAt: c.created_at,
    }));
  return {
    id: r.id,
    dogId: r.dog_id,
    dogName: dog?.name,
    dogPhoto: dog?.photo_url ?? null,
    status: r.status,
    publishedAt: r.published_at,
    date: r.session_date ? `${r.session_date}T12:00:00Z` : r.created_at,
    focus: r.title?.trim() || homework.map((c) => c.name).join(" · ") || "Training session",
    summary: r.summary ?? "",
    wins: (r.wins ?? []).filter((w) => w.trim()),
    strength: r.strength ?? "",
    toImprove: r.to_improve ?? "",
    homework,
    comments,
    isNew: !staff && r.status === "published" && !r.seen_at,
  };
}

async function fetchAll(): Promise<ReportsState> {
  const client = sb();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { ...EMPTY, loaded: true };

  const [{ data: isAdmin }, cardsRes, doneRes, resetRes] = await Promise.all([
    client.rpc("nn_is_admin"),
    client.from("report_cards").select(CARD_COLUMNS).order("session_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(500),
    client.from("homework_completions").select("report_card_item_id, practised_on").limit(5000),
    client.from("homework_resets").select("dog_id, reset_at"),
  ]);
  if (cardsRes.error) throw friendly("Couldn't load report cards", cardsRes.error);
  const staff = isAdmin === true;
  const rows = (cardsRes.data ?? []) as unknown as CardRow[];
  const cards = rows.map((r) => toCard(r, staff));

  // Days per card: any of its items practised that day counts once.
  const itemToCard = new Map<string, string>();
  for (const r of rows) for (const it of r.report_card_items ?? []) itemToCard.set(it.id, r.id);
  const daySets: Record<string, Set<string>> = {};
  for (const row of (doneRes.data ?? []) as { report_card_item_id: string; practised_on: string }[]) {
    const card = itemToCard.get(row.report_card_item_id);
    if (!card) continue;
    (daySets[card] ??= new Set()).add(row.practised_on);
  }
  const progress: Progress = {};
  for (const [card, set] of Object.entries(daySets)) progress[card] = [...set].sort();

  const resets: Resets = {};
  for (const r of (resetRes.data ?? []) as { dog_id: string; reset_at: string }[]) resets[r.dog_id] = r.reset_at;

  return { loaded: true, error: null, staff, cards, progress, resets };
}

/** Reload everything (after a write, or when the signed-in account changes). */
export function refreshReports(): Promise<void> {
  if (loading) return loading;
  loading = fetchAll()
    .then((next) => emit(next))
    .catch((err: unknown) =>
      emit({ ...state, loaded: true, error: err instanceof Error ? err.message : "Couldn't load report cards." })
    )
    .finally(() => {
      loading = null;
    });
  return loading;
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  void refreshReports();
  sb().auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
      if (event === "SIGNED_OUT") emit({ ...EMPTY, loaded: true });
      void refreshReports();
    }
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  start();
  return () => {
    listeners.delete(cb);
  };
}

/** The live report-card state. Empty (loaded: false) on the server and first render. */
export function useReports(): ReportsState {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}

/** Newest first. */
export const byDateDesc = (a: ReportCard, b: ReportCard) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

// --- Owner -------------------------------------------------------------------

/**
 * "Complete today" for a card: nn_homework_complete_day records the day (UK
 * date) — once a day, never past 3 days — and a homework_completions row per
 * drill, as the app does. Optimistic.
 */
export async function logHomeworkDay(cardId: string, day: string): Promise<void> {
  const card = state.cards.find((c) => c.id === cardId);
  if (!card?.dogId) return;
  const days = state.progress[cardId] ?? [];
  if (days.includes(day) || days.length >= 3) return;
  const client = sb();
  const before = state;
  emit({ ...state, progress: { ...state.progress, [cardId]: [...days, day].sort() } });
  const { error } = await client.rpc("nn_homework_complete_day", { p_card_id: cardId, p_title: card.focus });
  if (error) {
    emit(before);
    if (/already done today/i.test(error.message)) return;
    throw friendly("Couldn't save today's homework", error);
  }
}

/** Clear the "new" badge on cards the owner has now seen. */
export async function markSeen(ids: string[]): Promise<void> {
  const unseen = state.cards.filter((c) => c.isNew && ids.includes(c.id)).map((c) => c.id);
  if (unseen.length === 0) return;
  emit({ ...state, cards: state.cards.map((c) => (unseen.includes(c.id) ? { ...c, isNew: false } : c)) });
  const { error } = await sb().rpc("mark_report_cards_seen", { p_ids: unseen });
  if (error) console.error("markSeen failed", error.message);
}

/** A question (owner) or reply (trainer) on a card. */
export async function addComment(cardId: string, body: string, authorName: string): Promise<void> {
  const text = body.trim();
  if (!text) return;
  const client = sb();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error("Please log in first.");
  const { error } = await client.from("report_card_comments").insert({
    report_card_id: cardId,
    author_id: user.id,
    author_role: state.staff ? "staff" : "owner",
    author_name: state.staff ? "Nelly & Nova" : authorName,
    body: text.slice(0, 2000),
  });
  if (error) throw friendly("Couldn't send that", error);
  await refreshReports();
}

// --- Trainer -----------------------------------------------------------------

export type CardDraft = {
  dogId: string;
  sessionDate: string; // YYYY-MM-DD
  summary: string;
  wins: string[];
  strength?: string;
  toImprove?: string;
  homework: { name: string; drills: { id?: string; name: string; ref?: string | null; pillar?: string | null }[] }[];
};

/** Title from the homework categories ("Recall · Settle"). */
export function draftTitle(d: Pick<CardDraft, "homework">): string {
  return d.homework.map((c) => c.name.trim()).filter(Boolean).join(" · ");
}

/** Replace a card's items, keeping the ids of drills that stay (and so their practice days). */
async function writeItems(cardId: string, homework: CardDraft["homework"]): Promise<void> {
  const client = sb();
  const { data: existing, error: readErr } = await client.from("report_card_items").select("id").eq("report_card_id", cardId);
  if (readErr) throw friendly("Couldn't save the homework", readErr);
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
      if (d.id && /^[0-9a-f-]{36}$/.test(d.id) && (existing ?? []).some((e) => e.id === d.id)) {
        row.id = d.id;
        keep.add(d.id);
      }
      rows.push(row);
    });
  }
  const gone = (existing ?? []).map((e) => e.id as string).filter((id) => !keep.has(id));
  if (gone.length) {
    const { error } = await client.from("report_card_items").delete().in("id", gone);
    if (error) throw friendly("Couldn't save the homework", error);
  }
  const updates = rows.filter((r) => r.id);
  const inserts = rows.filter((r) => !r.id);
  for (const u of updates) {
    const { id, ...patch } = u;
    const { error } = await client.from("report_card_items").update(patch).eq("id", id as string);
    if (error) throw friendly("Couldn't save the homework", error);
  }
  if (inserts.length) {
    const { error } = await client.from("report_card_items").insert(inserts);
    if (error) throw friendly("Couldn't save the homework", error);
  }
}

/**
 * Save a trainer's card as a draft (owners can't see drafts). Creates it, or
 * updates the dog's draft for that session date. Returns the card id.
 */
export async function saveDraftCard(d: CardDraft, cardId?: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/.test(d.dogId)) {
    throw new Error("This dog isn't on the system yet, so a report card can't be saved for them.");
  }
  const client = sb();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error("Please log in first.");
  let id = cardId;
  if (!id) {
    const { data: found } = await client
      .from("report_cards")
      .select("id")
      .eq("dog_id", d.dogId)
      .eq("session_date", d.sessionDate)
      .eq("status", "draft")
      .limit(1)
      .maybeSingle();
    id = (found?.id as string | undefined) ?? undefined;
  }
  const fields = {
    title: draftTitle(d) || null,
    summary: d.summary.trim() || null,
    wins: d.wins.map((w) => w.trim()).filter(Boolean),
    strength: d.strength?.trim().slice(0, 200) || null,
    to_improve: d.toImprove?.trim().slice(0, 200) || null,
    session_date: d.sessionDate,
  };
  if (id) {
    const { error } = await client.from("report_cards").update(fields).eq("id", id);
    if (error) throw friendly("Couldn't save the report card", error);
  } else {
    const { data, error } = await client
      .from("report_cards")
      .insert({ ...fields, dog_id: d.dogId, author_id: user.id, status: "draft" })
      .select("id")
      .single();
    if (error) throw friendly("Couldn't save the report card", error);
    id = data.id as string;
  }
  await writeItems(id, d.homework);
  await refreshReports();
  return id;
}

/** Revise a card's homework after it's written (or sent). */
export async function saveCardHomework(cardId: string, categories: HomeworkCategory[]): Promise<void> {
  const { error } = await sb()
    .from("report_cards")
    .update({ title: categories.map((c) => c.name.trim()).filter(Boolean).join(" · ") || null })
    .eq("id", cardId);
  if (error) throw friendly("Couldn't save the homework", error);
  await writeItems(
    cardId,
    categories.map((c) => ({ name: c.name, drills: c.drills.map((d) => ({ id: d.id, name: d.name, ref: d.ref, pillar: d.pillar })) }))
  );
  await refreshReports();
}

/**
 * Publish cards to their owners: the website marks them published and emails
 * and notifies each owner (app/api/reports/publish). Returns how many went.
 */
export async function publishCards(ids: string[]): Promise<{ published: number; notified: number }> {
  if (ids.length === 0) return { published: 0, notified: 0 };
  const res = await fetch("/api/reports/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  const body = (await res.json().catch(() => null)) as { published?: number; notified?: number; error?: string } | null;
  await refreshReports();
  if (!res.ok) throw new Error(body?.error ?? "Couldn't send the report cards. Please try again.");
  return { published: body?.published ?? 0, notified: body?.notified ?? 0 };
}

/** Delete a draft (or a sent card) — trainers only. */
export async function deleteCard(id: string): Promise<void> {
  const { error } = await sb().from("report_cards").delete().eq("id", id);
  if (error) throw friendly("Couldn't delete the report card", error);
  await refreshReports();
}

/** Reset a dog's homework completion to 100% as of now (after booking a 1-1). */
export async function resetHomework(dogId: string): Promise<void> {
  const client = sb();
  const {
    data: { user },
  } = await client.auth.getUser();
  const at = new Date().toISOString();
  const before = state;
  emit({ ...state, resets: { ...state.resets, [dogId]: at } });
  const { error } = await client.from("homework_resets").upsert({ dog_id: dogId, reset_at: at, reset_by: user?.id ?? null });
  if (error) {
    emit(before);
    throw friendly("Couldn't reset the homework", error);
  }
}
