"use client";

/**
 * Homework resets (scaffold — localStorage).
 * ------------------------------------------
 * A trainer can reset a dog's homework completion to 100% — offered when the
 * owner books a 1-1 so missed homework can be worked through together. We store
 * the reset moment per dog; completion is then measured only from report cards
 * dated on or after it.
 */
import { useSyncExternalStore } from "react";
import { resetHomework } from "./data";

type Resets = Record<string, string>; // dogId → ISO reset timestamp
const EMPTY: Resets = {};
const KEY = "nn-homework-reset";
const EVENT = "nn-homework-reset-change";

function read(): Resets {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Resets;
  } catch {
    return EMPTY;
  }
}

function write(r: Resets) {
  localStorage.setItem(KEY, JSON.stringify(r));
  window.dispatchEvent(new Event(EVENT));
}

/** Reset a dog's homework to 100% as of now. */
export function resetDogHomework(dogId: string) {
  const at = new Date().toISOString();
  write({ ...read(), [dogId]: at });
  void resetHomework(dogId, at);
}

export function resetAtFor(resets: Resets, dogId: string | undefined): string | undefined {
  return dogId ? resets[dogId] : undefined;
}

// --- store wiring for useSyncExternalStore --------------------------------
let cache: Resets = EMPTY;
let cacheRaw: string | null | undefined = undefined;

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): Resets {
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

function getServerSnapshot(): Resets {
  return EMPTY;
}

export function useHomeworkResets(): Resets {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
