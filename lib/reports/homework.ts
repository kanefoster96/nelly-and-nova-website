"use client";

/**
 * Homework edits (scaffold — localStorage).
 * -----------------------------------------
 * A trainer can revise a report card's homework after it's sent — rename a
 * drill, add or remove drills, add or remove categories — either from the
 * report card itself or the dashboard's Homework section. Edits are stored as a
 * per-card override of the categories and applied wherever the card renders.
 * TODO(backend): persist to homework_categories/drills; a drill keeps its id so
 * the owner's completed state survives an edit.
 */
import { useSyncExternalStore } from "react";
import type { HomeworkCategory } from "./types";
import { saveHomework } from "./data";

type Overrides = Record<string, HomeworkCategory[]>;
const EMPTY: Overrides = {};
const KEY = "nn-homework-edits";
const EVENT = "nn-homework-edits-change";

function read(): Overrides {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Overrides;
  } catch {
    return EMPTY;
  }
}

function write(o: Overrides) {
  localStorage.setItem(KEY, JSON.stringify(o));
  window.dispatchEvent(new Event(EVENT));
}

/** Save a card's revised homework (drills with blank names become "Drill N"). */
export function saveCardHomework(cardId: string, categories: HomeworkCategory[]) {
  const normalised = categories.map((c) => ({
    ...c,
    name: c.name.trim(),
    drills: c.drills.map((d, i) => ({ ...d, name: d.name.trim() || `Drill ${i + 1}` })),
  }));
  write({ ...read(), [cardId]: normalised });
  void saveHomework(cardId, normalised);
}

/** Apply any saved edit onto a card's homework. */
export function applyHomeworkOverride(
  cardId: string,
  homework: HomeworkCategory[],
  overrides: Overrides
): HomeworkCategory[] {
  return overrides[cardId] ?? homework;
}

// --- store wiring for useSyncExternalStore --------------------------------
let cache: Overrides = EMPTY;
let cacheRaw: string | null | undefined = undefined;

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): Overrides {
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

function getServerSnapshot(): Overrides {
  return EMPTY;
}

export function useHomeworkOverrides(): Overrides {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
