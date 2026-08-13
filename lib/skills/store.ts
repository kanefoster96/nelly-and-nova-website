"use client";

/**
 * Per-dog skills store (scaffold — localStorage).
 * -----------------------------------------------
 * Which skills a dog has "learnt". Trainers toggle them on a dog's profile; the
 * owner only reads the aggregate (learnt/total per pillar). Seeded from
 * SAMPLE_LEARNT until a trainer edits a dog, after which the overlay holds the
 * full learnt list for that dog.
 */
import { useSyncExternalStore } from "react";
import { SAMPLE_LEARNT } from "@/config/skills";
import { saveSkill } from "./data";

type SkillState = Record<string, string[]>; // dogId -> learnt skill ids
const EMPTY: SkillState = {};
const KEY = "nn-skills";
const EVENT = "nn-skills-change";

function read(): SkillState {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as SkillState;
  } catch {
    return EMPTY;
  }
}

function write(s: SkillState) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event(EVENT));
}

/** The learnt skill ids for a dog — the trainer's edits, else the seed. */
export function learntArray(state: SkillState, dogId?: string): string[] {
  if (!dogId) return [];
  return state[dogId] ?? SAMPLE_LEARNT[dogId] ?? [];
}

/** As a Set, for O(1) membership checks in progress maths. */
export function learntSet(state: SkillState, dogId?: string): Set<string> {
  return new Set(learntArray(state, dogId));
}

/** Trainer action: flip a skill between learnt and to-learn for a dog. */
export function toggleSkill(dogId: string, drillId: string) {
  const cur = read();
  const arr = cur[dogId] ?? SAMPLE_LEARNT[dogId] ?? [];
  const next = arr.includes(drillId)
    ? arr.filter((x) => x !== drillId)
    : [...arr, drillId];
  write({ ...cur, [dogId]: next });
  void saveSkill(dogId, drillId, next.includes(drillId));
}

// --- hook -----------------------------------------------------------------

let cache: SkillState = EMPTY;
let cacheRaw: string | null | undefined = undefined;

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): SkillState {
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

function getServerSnapshot(): SkillState {
  return EMPTY;
}

export function useSkills(): SkillState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
