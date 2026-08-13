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
import { HOMEWORK_LIBRARY } from "@/config/homeworkLibrary";

export type LibDrillState = { id: string; name: string; level: number };
export type LibraryOverlay = { categories: Record<string, LibDrillState[]> };

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
    lvl.drills.map((d) => ({ id: d.id, name: d.name, level: lvl.level }))
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

/** Move a drill up (-1) or down (+1) among the drills at its own level. */
export function reorderDrill(pillarId: string, categoryId: string, drillId: string, dir: -1 | 1) {
  update(pillarId, categoryId, (drills) => {
    const i = drills.findIndex((d) => d.id === drillId);
    if (i < 0) return drills;
    const level = drills[i].level;
    let j = i + dir;
    while (j >= 0 && j < drills.length && drills[j].level !== level) j += dir;
    if (j < 0 || j >= drills.length || drills[j].level !== level) return drills;
    [drills[i], drills[j]] = [drills[j], drills[i]];
    return drills;
  });
}

/** Promote (+1) or demote (-1) a drill to an adjacent level (min level 1). */
export function changeDrillLevel(
  pillarId: string,
  categoryId: string,
  drillId: string,
  delta: -1 | 1
) {
  update(pillarId, categoryId, (drills) => {
    const i = drills.findIndex((d) => d.id === drillId);
    if (i < 0) return drills;
    const newLevel = Math.max(1, drills[i].level + delta);
    const [drill] = drills.splice(i, 1);
    drill.level = newLevel;
    drills.splice(endOfLevel(drills, newLevel), 0, drill);
    return drills;
  });
}

export function addLibraryDrill(pillarId: string, categoryId: string, level: number, name: string) {
  const text = name.trim();
  if (!text) return;
  update(pillarId, categoryId, (drills) => {
    const id = `custom-${pillarId}-${categoryId}-${level}-${drills.length}-${text.length}`;
    drills.splice(endOfLevel(drills, level), 0, { id, name: text, level });
    return drills;
  });
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
