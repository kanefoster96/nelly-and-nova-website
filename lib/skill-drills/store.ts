"use client";

/**
 * Per-skill drill pages (scaffold — localStorage).
 * ------------------------------------------------
 * Every trackable skill (Engagement / Skills / Mindset) can have its own
 * blog-style "how to train this" page — ordered headings, paragraphs, photos
 * and videos. The trainer builds these from the Status panel by opening a
 * skill; the content is the same for every dog (it's the method, not the dog's
 * progress), so it's keyed on the skill id, not the dog.
 */
import { useSyncExternalStore } from "react";
import type { DrillBlock } from "@/config/homeworkLibrary";

export type SkillDrillOverlay = { skills: Record<string, DrillBlock[]> };

const EMPTY: SkillDrillOverlay = { skills: {} };
const KEY = "nn-skill-drills";
const EVENT = "nn-skill-drills-change";

/** The drill-page blocks for one skill (empty until the trainer adds any). */
export function skillBlocks(overlay: SkillDrillOverlay, skillId: string): DrillBlock[] {
  return overlay.skills[skillId] ?? [];
}

function read(): SkillDrillOverlay {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as SkillDrillOverlay) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function write(o: SkillDrillOverlay) {
  localStorage.setItem(KEY, JSON.stringify(o));
  window.dispatchEvent(new Event(EVENT));
  // TODO(backend): persist skill drill pages to skill_drills (blocks per skill).
}

function updateBlocks(skillId: string, fn: (blocks: DrillBlock[]) => DrillBlock[]) {
  const o = read();
  const cur = [...(o.skills[skillId] ?? [])];
  write({ ...o, skills: { ...o.skills, [skillId]: fn(cur) } });
}

/** Append a content block to a skill's page. Pass a fresh id (crypto.randomUUID). */
export function addSkillBlock(skillId: string, block: DrillBlock) {
  updateBlocks(skillId, (blocks) => [...blocks, block]);
}

/** Edit a heading/paragraph block's text. */
export function updateSkillBlockText(skillId: string, blockId: string, text: string) {
  updateBlocks(skillId, (blocks) =>
    blocks.map((b) =>
      b.id === blockId && (b.type === "heading" || b.type === "paragraph") ? { ...b, text } : b
    )
  );
}

export function moveSkillBlock(skillId: string, blockId: string, dir: -1 | 1) {
  updateBlocks(skillId, (blocks) => {
    const i = blocks.findIndex((b) => b.id === blockId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return blocks;
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    return blocks;
  });
}

export function removeSkillBlock(skillId: string, blockId: string) {
  updateBlocks(skillId, (blocks) => blocks.filter((b) => b.id !== blockId));
}

// --- hook -----------------------------------------------------------------

let cache: SkillDrillOverlay = EMPTY;
let cacheRaw: string | null | undefined = undefined;

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): SkillDrillOverlay {
  const raw = (() => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  })();
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cache = read();
  }
  return cache;
}

function getServerSnapshot(): SkillDrillOverlay {
  return EMPTY;
}

export function useSkillDrills(): SkillDrillOverlay {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
