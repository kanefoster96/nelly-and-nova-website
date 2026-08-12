"use client";

/**
 * Homework completion (scaffold — localStorage).
 * ----------------------------------------------
 * Homework is done by practising it on three separate days, not by ticking a
 * checklist. Each report card tracks the calendar dates its homework was
 * completed on (max three). The rules:
 *   - one day can be logged per card per calendar day (the date is saved, so
 *     you can't tick three off in one sitting),
 *   - the limit is per card, so someone with two cards can log a day on each
 *     on the same date.
 * TODO(backend): persist to homework_completions (report_id, date) with a
 * UNIQUE(report_id, date) constraint enforcing one-per-day server-side.
 */
import { useSyncExternalStore } from "react";
import { logHomeworkDay } from "./data";

/** Homework counts as complete once done on this many separate days. */
export const HOMEWORK_TARGET_DAYS = 3;

type Progress = Record<string, string[]>; // cardId → ISO dates (YYYY-MM-DD)
const EMPTY: Progress = {};
const KEY = "nn-homework-progress";
const EVENT = "nn-homework-progress-change";

function read(): Progress {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Progress;
  } catch {
    return EMPTY;
  }
}

function write(p: Progress) {
  localStorage.setItem(KEY, JSON.stringify(p));
  window.dispatchEvent(new Event(EVENT));
}

/** The dates this card's homework has been completed on. */
export function daysFor(progress: Progress, cardId: string): string[] {
  return progress[cardId] ?? [];
}

/**
 * Log today's completion for a card. No-op if today is already logged for this
 * card, or it's already been done the target number of days.
 */
export function markHomeworkDay(cardId: string, today: string) {
  const cur = read();
  const days = cur[cardId] ?? [];
  if (days.includes(today) || days.length >= HOMEWORK_TARGET_DAYS) return;
  write({ ...cur, [cardId]: [...days, today] });
  void logHomeworkDay(cardId, today);
}

// --- store wiring for useSyncExternalStore --------------------------------
let cache: Progress = EMPTY;
let cacheRaw: string | null | undefined = undefined;

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): Progress {
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

function getServerSnapshot(): Progress {
  return EMPTY;
}

export function useHomeworkProgress(): Progress {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
