"use client";

/**
 * Per-skill drill pages — live (skill_drill_blocks).
 * --------------------------------------------------
 * Every trackable skill (Engagement / Skills / Mindset) can have its own
 * blog-style "how to train this" page — ordered headings, paragraphs, photos
 * and videos. The trainer builds these from a dog's skills; the content is
 * the same for every dog (it's the method, not the dog's progress), so it's
 * keyed on the skill id. Everyone signed in reads; trainers write (RLS).
 */
import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DrillBlock } from "@/config/homeworkLibrary";
import { saveBlockOrder, saveBlockTextSoon, toBlock, uploadDrillMedia } from "@/lib/homework-library/store";

export type SkillDrillOverlay = { loaded: boolean; skills: Record<string, DrillBlock[]> };

const EMPTY: SkillDrillOverlay = { loaded: false, skills: {} };
let state: SkillDrillOverlay = EMPTY;
const listeners = new Set<() => void>();
let started = false;

function sb() {
  return createClient();
}

function emit(next: SkillDrillOverlay) {
  state = next;
  for (const l of listeners) l();
}

/** The drill-page blocks for one skill (empty until the trainer adds any). */
export function skillBlocks(overlay: SkillDrillOverlay, skillId: string): DrillBlock[] {
  return overlay.skills[skillId] ?? [];
}

export async function refreshSkillDrills(): Promise<void> {
  const { data, error } = await sb().from("skill_drill_blocks").select("id, skill_id, type, text, url, sort_order").order("sort_order");
  if (error) {
    console.error("[skill-drills]", error.message);
    emit({ ...state, loaded: true });
    return;
  }
  const skills: Record<string, DrillBlock[]> = {};
  for (const r of data ?? []) (skills[r.skill_id as string] ??= []).push(toBlock(r as Parameters<typeof toBlock>[0]));
  emit({ loaded: true, skills });
}

function report(err: unknown) {
  console.error("[skill-drills]", err);
  void refreshSkillDrills();
}

function update(skillId: string, fn: (blocks: DrillBlock[]) => DrillBlock[]): DrillBlock[] {
  const blocks = fn([...(state.skills[skillId] ?? [])]);
  emit({ ...state, skills: { ...state.skills, [skillId]: blocks } });
  return blocks;
}

/** Append a content block to a skill's page. Pass a fresh id (crypto.randomUUID). */
export function addSkillBlock(skillId: string, block: DrillBlock) {
  const blocks = update(skillId, (b) => [...b, block]);
  (async () => {
    let url: string | null = null;
    if (block.type === "image" || block.type === "video") {
      url = await uploadDrillMedia(block.url);
      update(skillId, (b) => b.map((x) => (x.id === block.id ? { ...block, url: url! } : x)));
    }
    const { error } = await sb().from("skill_drill_blocks").insert({
      id: block.id,
      skill_id: skillId,
      type: block.type,
      text: block.type === "heading" || block.type === "paragraph" ? block.text : null,
      url,
      sort_order: blocks.length - 1,
    });
    if (error) throw new Error(error.message);
  })().catch(report);
}

/** Edit a heading/paragraph block's text. */
export function updateSkillBlockText(skillId: string, blockId: string, text: string) {
  update(skillId, (blocks) =>
    blocks.map((b) => (b.id === blockId && (b.type === "heading" || b.type === "paragraph") ? { ...b, text } : b))
  );
  saveBlockTextSoon("skill_drill_blocks", blockId, text, report);
}

export function moveSkillBlock(skillId: string, blockId: string, dir: -1 | 1) {
  const blocks = update(skillId, (blocks) => {
    const i = blocks.findIndex((b) => b.id === blockId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return blocks;
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    return blocks;
  });
  saveBlockOrder("skill_drill_blocks", blocks).catch(report);
}

export function removeSkillBlock(skillId: string, blockId: string) {
  update(skillId, (blocks) => blocks.filter((b) => b.id !== blockId));
  (async () => {
    const { error } = await sb().from("skill_drill_blocks").delete().eq("id", blockId);
    if (error) throw new Error(error.message);
  })().catch(report);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!started && typeof window !== "undefined") {
    started = true;
    void refreshSkillDrills();
  }
  return () => {
    listeners.delete(cb);
  };
}

export function useSkillDrills(): SkillDrillOverlay {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}
