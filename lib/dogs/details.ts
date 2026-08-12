"use client";

/**
 * Dog detail edits (scaffold — localStorage).
 * -------------------------------------------
 * Overrides layered over the base dog list so a coach can edit a dog's info
 * (name, owner, breed, age, notes) without a backend yet. Client-only stand-in
 * for lib/dogs/data.ts → saveDogDetails, which the backend will persist.
 */
import { useSyncExternalStore } from "react";
import { saveDogDetails, type DogDetails } from "./data";

export type DetailPatch = Partial<DogDetails>;
type Overrides = Record<string, DetailPatch>;

const KEY = "nn-dog-details";
const EVENT = "nn-dog-details-change";
const EMPTY: Overrides = {};

function read(): Overrides {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Overrides;
  } catch {
    return EMPTY;
  }
}

/** Save a dog's edited details (merges over any existing edit). */
export function saveDetails(id: string, patch: DetailPatch) {
  const ov = read();
  const next = { ...ov, [id]: { ...ov[id], ...patch } };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
  void saveDogDetails(id, patch); // backend seam (TODO)
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

export function useDogDetails(): Overrides {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
