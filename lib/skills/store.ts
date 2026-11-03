"use client";

/**
 * Skills and each dog's progress — live from Supabase.
 * ----------------------------------------------------
 *   skills      the checklist, per pillar and level (Engagement / Skills / Mindset)
 *   dog_skills  a row per skill a dog has learnt (who ticked it, when)
 *
 * Trainers tick skills off per dog; owners read their own dogs' rows and see
 * the level per pillar (Row Level Security). The pillars' names and blurbs
 * come from config/skills.ts; the skills themselves from the table.
 */
import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { SKILL_PILLARS, type SkillPillar } from "@/config/skills";

export type SkillsState = {
  loaded: boolean;
  error: string | null;
  /** The pillars with their skills from the `skills` table. */
  pillars: SkillPillar[];
  /** dogId → skillId → when it was learnt. */
  learnt: Record<string, Record<string, string>>;
};

const EMPTY: SkillsState = { loaded: false, error: null, pillars: SKILL_PILLARS, learnt: {} };
let state: SkillsState = EMPTY;
const listeners = new Set<() => void>();
let started = false;

function sb() {
  return createClient();
}

function emit(next: SkillsState) {
  state = next;
  for (const l of listeners) l();
}

export async function refreshSkills(): Promise<void> {
  const client = sb();
  const [skillsRes, dogRes] = await Promise.all([
    client.from("skills").select("id, pillar, name, level, sort_order").order("sort_order"),
    client.from("dog_skills").select("dog_id, skill_id, learnt_at").limit(10000),
  ]);
  if (skillsRes.error || dogRes.error) {
    emit({ ...state, loaded: true, error: (skillsRes.error ?? dogRes.error)?.message ?? "Couldn't load skills." });
    return;
  }
  const rows = (skillsRes.data ?? []) as { id: string; pillar: string; name: string; level: number; sort_order: number }[];
  const pillars: SkillPillar[] = SKILL_PILLARS.map((p) => ({
    ...p,
    drills: rows
      .filter((r) => r.pillar === p.id)
      .sort((a, b) => a.level - b.level || a.sort_order - b.sort_order)
      .map((r) => ({ id: r.id, name: r.name, level: r.level })),
  }));
  const learnt: SkillsState["learnt"] = {};
  for (const r of (dogRes.data ?? []) as { dog_id: string; skill_id: string; learnt_at: string }[]) {
    (learnt[r.dog_id] ??= {})[r.skill_id] = r.learnt_at;
  }
  emit({ loaded: true, error: null, pillars: rows.length ? pillars : SKILL_PILLARS, learnt });
}

/** The learnt skill ids for a dog. */
export function learntArray(s: SkillsState, dogId?: string): string[] {
  return dogId ? Object.keys(s.learnt[dogId] ?? {}) : [];
}

/** As a Set, for O(1) membership checks in progress maths. */
export function learntSet(s: SkillsState, dogId?: string): Set<string> {
  return new Set(learntArray(s, dogId));
}

/** When a dog learnt a skill (ISO), if they have. */
export function learntAt(s: SkillsState, dogId: string, skillId: string): string | undefined {
  return s.learnt[dogId]?.[skillId];
}

/**
 * Trainer: save a dog's skills — `changes` maps skill id → learnt or not.
 * Shows straight away; throws a friendly Error (and reloads) if it fails.
 */
export async function setDogSkills(dogId: string, changes: Record<string, boolean>): Promise<void> {
  const on = Object.entries(changes).filter(([, v]) => v).map(([k]) => k);
  const off = Object.entries(changes).filter(([, v]) => !v).map(([k]) => k);
  if (on.length === 0 && off.length === 0) return;
  const now = new Date().toISOString();
  const mine = { ...(state.learnt[dogId] ?? {}) };
  for (const id of on) mine[id] ??= now;
  for (const id of off) delete mine[id];
  emit({ ...state, learnt: { ...state.learnt, [dogId]: mine } });

  const client = sb();
  const {
    data: { user },
  } = await client.auth.getUser();
  try {
    if (on.length) {
      const { error } = await client
        .from("dog_skills")
        .upsert(on.map((skill_id) => ({ dog_id: dogId, skill_id, marked_by: user?.id ?? null })), { onConflict: "dog_id,skill_id", ignoreDuplicates: true });
      if (error) throw error;
    }
    if (off.length) {
      const { error } = await client.from("dog_skills").delete().eq("dog_id", dogId).in("skill_id", off);
      if (error) throw error;
    }
  } catch (err) {
    await refreshSkills();
    const msg = (err as { message?: string })?.message ?? "";
    throw new Error(/row-level security|permission/i.test(msg) ? "Only trainers can change skills." : `Couldn't save the skills. ${msg}`.trim());
  }
}

/** Trainer action: flip one skill between learnt and to-learn for a dog. */
export function toggleSkill(dogId: string, skillId: string) {
  const has = Boolean(state.learnt[dogId]?.[skillId]);
  setDogSkills(dogId, { [skillId]: !has }).catch((err) => console.error("[skills]", err));
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!started && typeof window !== "undefined") {
    started = true;
    void refreshSkills();
    sb().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") void refreshSkills();
    });
  }
  return () => {
    listeners.delete(cb);
  };
}

export function useSkills(): SkillsState {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}
