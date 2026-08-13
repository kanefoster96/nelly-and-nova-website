"use client";

/**
 * Homework-library arrangement (scaffold — localStorage).
 * -------------------------------------------------------
 * The trainer's ordering of drills within each category: which level a drill
 * sits at and its order in that level. Once a category is touched, its full
 * ordered drill list is stored (seeded from the config templates), and every
 * move/add/remove mutates that list. Read back on both the trainer's library
 * and (by drill name) the owner's practice screen.
 */
import { useSyncExternalStore } from "react";
import { HOMEWORK_LIBRARY, type DrillBlock } from "@/config/homeworkLibrary";

export type LibDrillState = { id: string; name: string; level: number; blocks: DrillBlock[] };
export type LibraryOverlay = { categories: Record<string, LibDrillState[]> };

/** Highest level a drill can be promoted to (a safety cap on new levels). */
export const MAX_LEVEL = 5;

const EMPTY: LibraryOverlay = { categories: {} };
const KEY = "nn-homework-lib-v2";
const EVENT = "nn-homework-lib-change";

export function catKey(pillarId: string, categoryId: string): string {
  return `${pillarId}:${categoryId}`;
}

/** The category's drills straight from the config templates, level by level. */
function baseCategory(pillarId: string, categoryId: string): LibDrillState[] {
  const cat = HOMEWORK_LIBRARY.find((p) => p.id === pillarId)?.categories.find(
    (c) => c.id === categoryId
  );
  if (!cat) return [];
  return cat.levels.flatMap((lvl) =>
    lvl.drills.map((d) => ({ id: d.id, name: d.name, level: lvl.level, blocks: d.blocks }))
  );
}

/** The trainer's arrangement for a category (their edits, else the template). */
export function categoryDrills(
  overlay: LibraryOverlay,
  pillarId: string,
  categoryId: string
): LibDrillState[] {
  return overlay.categories[catKey(pillarId, categoryId)] ?? baseCategory(pillarId, categoryId);
}

/** Index of drill name → { pillar, level } across the whole library arrangement. */
export function libraryNameIndex(overlay: LibraryOverlay): Map<string, { pillar: string; level: number }> {
  const map = new Map<string, { pillar: string; level: number }>();
  for (const pillar of HOMEWORK_LIBRARY) {
    for (const cat of pillar.categories) {
      for (const d of categoryDrills(overlay, pillar.id, cat.id)) {
        map.set(d.name.toLowerCase(), { pillar: pillar.id, level: d.level });
      }
    }
  }
  return map;
}

function read(): LibraryOverlay {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as LibraryOverlay) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function write(o: LibraryOverlay) {
  localStorage.setItem(KEY, JSON.stringify(o));
  window.dispatchEvent(new Event(EVENT));
  // TODO(backend): persist the arrangement to homework_library (order + level).
}

function update(
  pillarId: string,
  categoryId: string,
  fn: (drills: LibDrillState[]) => LibDrillState[]
) {
  const o = read();
  const key = catKey(pillarId, categoryId);
  const cur = (o.categories[key] ?? baseCategory(pillarId, categoryId)).map((d) => ({ ...d }));
  write({ ...o, categories: { ...o.categories, [key]: fn(cur) } });
}

/** Position just after the last drill at or below `level` (end of that group). */
function endOfLevel(drills: LibDrillState[], level: number): number {
  let idx = 0;
  drills.forEach((d, i) => {
    if (d.level <= level) idx = i + 1;
  });
  return idx;
}

/**
 * Move a drill up (-1) or down (+1) through the one ordered list. Within its
 * level it swaps with the neighbour; at a level boundary it crosses into the
 * next level (down promotes, up demotes) — so a card walks up and down the
 * whole list and the level headings sort themselves out. The last drill moving
 * down opens a new level (up to MAX_LEVEL).
 */
export function moveDrill(pillarId: string, categoryId: string, drillId: string, dir: -1 | 1) {
  update(pillarId, categoryId, (drills) => {
    const i = drills.findIndex((d) => d.id === drillId);
    if (i < 0) return drills;
    const level = drills[i].level;
    const j = i + dir;

    if (j < 0) return drills; // already at the very top
    if (j >= drills.length) {
      // At the very bottom — moving down starts a new (higher) level.
      if (dir === 1 && level < MAX_LEVEL) drills[i].level = level + 1;
      return drills;
    }
    if (drills[j].level === level) {
      [drills[i], drills[j]] = [drills[j], drills[i]]; // reorder within the level
    } else if (dir === -1) {
      drills[i].level = drills[j].level; // demote across the boundary above
    } else {
      drills[i].level = drills[j].level; // promote across the boundary below
    }
    return drills;
  });
}

export function addLibraryDrill(
  pillarId: string,
  categoryId: string,
  level: number,
  name: string,
  description = ""
) {
  const text = name.trim();
  if (!text) return;
  update(pillarId, categoryId, (drills) => {
    const id = `custom-${pillarId}-${categoryId}-${level}-${drills.length}-${text.length}`;
    const blocks: DrillBlock[] = description.trim()
      ? [{ id: `${id}-p1`, type: "paragraph", text: description.trim() }]
      : [];
    drills.splice(endOfLevel(drills, level), 0, { id, name: text, level, blocks });
    return drills;
  });
}

// --- drill content blocks (the drill's blog-style page) -------------------

function updateBlocks(
  pillarId: string,
  categoryId: string,
  drillId: string,
  fn: (blocks: DrillBlock[]) => DrillBlock[]
) {
  update(pillarId, categoryId, (drills) =>
    drills.map((d) => (d.id === drillId ? { ...d, blocks: fn([...d.blocks]) } : d))
  );
}

/** Append a content block to a drill. Pass a fresh id (crypto.randomUUID). */
export function addBlock(pillarId: string, categoryId: string, drillId: string, block: DrillBlock) {
  updateBlocks(pillarId, categoryId, drillId, (blocks) => [...blocks, block]);
}

/** Edit a heading/paragraph block's text. */
export function updateBlockText(
  pillarId: string,
  categoryId: string,
  drillId: string,
  blockId: string,
  text: string
) {
  updateBlocks(pillarId, categoryId, drillId, (blocks) =>
    blocks.map((b) =>
      b.id === blockId && (b.type === "heading" || b.type === "paragraph") ? { ...b, text } : b
    )
  );
}

export function moveBlock(
  pillarId: string,
  categoryId: string,
  drillId: string,
  blockId: string,
  dir: -1 | 1
) {
  updateBlocks(pillarId, categoryId, drillId, (blocks) => {
    const i = blocks.findIndex((b) => b.id === blockId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return blocks;
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    return blocks;
  });
}

export function removeBlock(pillarId: string, categoryId: string, drillId: string, blockId: string) {
  updateBlocks(pillarId, categoryId, drillId, (blocks) => blocks.filter((b) => b.id !== blockId));
}

export function removeLibraryDrill(pillarId: string, categoryId: string, drillId: string) {
  update(pillarId, categoryId, (drills) => drills.filter((d) => d.id !== drillId));
}

// --- hook -----------------------------------------------------------------

let cache: LibraryOverlay = EMPTY;
let cacheRaw: string | null | undefined = undefined;

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): LibraryOverlay {
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

function getServerSnapshot(): LibraryOverlay {
  return EMPTY;
}

export function useLibrary(): LibraryOverlay {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
