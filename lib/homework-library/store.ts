"use client";

/**
 * Homework-library overlay (scaffold — localStorage).
 * ---------------------------------------------------
 * Trainer edits to the templated library: drills they add, and templated drills
 * they remove. Keyed per level (`pillar:category:level`). Merged over the
 * config templates when the library is browsed. Client-only stand-in for a
 * `homework_library` table.
 */
import { useSyncExternalStore } from "react";
import type { LibDrill } from "@/config/homeworkLibrary";

export type LibraryOverlay = {
  added: Record<string, LibDrill[]>; // levelKey -> extra drills
  removed: string[]; // drill ids hidden from the templates
};

const EMPTY: LibraryOverlay = { added: {}, removed: [] };
const KEY = "nn-homework-library";
const EVENT = "nn-homework-library-change";

/** Stable key for a pillar/category/level. */
export function levelKey(pillarId: string, categoryId: string, level: number): string {
  return `${pillarId}:${categoryId}:${level}`;
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
  // TODO(backend): upsert/delete rows in homework_library.
}

export function addDrill(key: string, name: string) {
  const text = name.trim();
  if (!text) return;
  const o = read();
  const drill: LibDrill = { id: `custom-${key}-${o.added[key]?.length ?? 0}-${text.length}`, name: text };
  write({ ...o, added: { ...o.added, [key]: [...(o.added[key] ?? []), drill] } });
}

export function removeDrill(key: string, drillId: string) {
  const o = read();
  // Custom drills are dropped from `added`; template drills go on `removed`.
  const added = o.added[key];
  if (added?.some((d) => d.id === drillId)) {
    write({ ...o, added: { ...o.added, [key]: added.filter((d) => d.id !== drillId) } });
  } else {
    write({ ...o, removed: o.removed.includes(drillId) ? o.removed : [...o.removed, drillId] });
  }
}

/** Template drills for a level merged with the overlay (removed out, added in). */
export function mergeDrills(base: LibDrill[], key: string, o: LibraryOverlay): LibDrill[] {
  return [...base.filter((d) => !o.removed.includes(d.id)), ...(o.added[key] ?? [])];
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

export function useLibraryOverlay(): LibraryOverlay {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
