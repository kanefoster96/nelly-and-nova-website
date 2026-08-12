"use client";

/**
 * Slot allocation overrides (scaffold — localStorage).
 * ----------------------------------------------------
 * Layered on top of the sample week so the coach can allocate slots without a
 * backend yet:
 *   - hold a spot for a customer on a day with space (a 'held' slot)
 *   - track onboarding (payment received, waiver signed) per held slot
 *   - confirm a held slot → 'permanent' once both are done
 *   - release a slot back to the day's capacity
 *
 * This is the client-only stand-in for lib/schedule/data.ts (holdSlot /
 * confirmSlot / releaseSlot), which the backend will persist to `schedule_slots`.
 */
import { useSyncExternalStore } from "react";
import {
  holdSlot as apiHold,
  confirmSlot as apiConfirm,
  releaseSlot as apiRelease,
} from "./data";
import type { DayId, DaySchedule, ScheduledDog, SlotStatus } from "./types";

export type ScheduleOverrides = {
  added: { day: DayId; dog: ScheduledDog }[];
  statusById: Record<string, SlotStatus>;
  released: string[];
};

const EMPTY: ScheduleOverrides = {
  added: [],
  statusById: {},
  released: [],
};

const KEY = "nn-schedule-overrides";
const EVENT = "nn-schedule-overrides-change";

function read(): ScheduleOverrides {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as ScheduleOverrides) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function write(ov: ScheduleOverrides) {
  localStorage.setItem(KEY, JSON.stringify(ov));
  window.dispatchEvent(new Event(EVENT));
}

/** Merge overrides onto the base week (pure — usable anywhere). */
export function applyOverrides(
  base: DaySchedule[],
  ov: ScheduleOverrides
): DaySchedule[] {
  const released = new Set(ov.released);
  const withStatus = (dog: ScheduledDog): ScheduledDog =>
    ov.statusById[dog.id] ? { ...dog, status: ov.statusById[dog.id] } : dog;

  return base.map((d) => {
    const existing = d.dogs
      .filter((dog) => !released.has(dog.id))
      .map(withStatus);
    const added = ov.added
      .filter((a) => a.day === d.day && !released.has(a.dog.id))
      .map((a) => withStatus(a.dog));
    return { ...d, dogs: [...existing, ...added] };
  });
}

// --- mutators -------------------------------------------------------------

export function holdSlot(day: DayId, dog: ScheduledDog) {
  const ov = read();
  write({ ...ov, added: [...ov.added, { day, dog }] });
  void apiHold(day, dog); // backend seam (TODO)
}

export function confirmSlot(dogId: string) {
  const ov = read();
  write({ ...ov, statusById: { ...ov.statusById, [dogId]: "permanent" } });
  void apiConfirm(dogId); // backend seam (TODO)
}

export function releaseSlot(dogId: string) {
  const ov = read();
  write({ ...ov, released: [...ov.released, dogId] });
  void apiRelease(dogId); // backend seam (TODO)
}

// --- store wiring for useSyncExternalStore --------------------------------
let cache: ScheduleOverrides = EMPTY;
let cacheRaw: string | null | undefined = undefined;

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): ScheduleOverrides {
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

/** Server (and first hydration render) see the base week; overrides apply after mount. */
function getServerSnapshot(): ScheduleOverrides {
  return EMPTY;
}

export function useScheduleOverrides(): ScheduleOverrides {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
