"use client";

/**
 * Homework completion — live (homework_completions).
 * --------------------------------------------------
 * Homework is done by practising it on three separate days, not by ticking a
 * checklist. Each report card tracks the calendar days its homework was
 * practised on (max three). The rules:
 *   - one day can be logged per card per calendar day (a unique index on
 *     homework_completions keeps it to one row per drill per day),
 *   - the limit is per card, so someone with two cards can log a day on each
 *     on the same date,
 *   - only on a published card, within 14 days of it (Row Level Security).
 */
import { useReports, logHomeworkDay } from "./client";

/** Homework counts as complete once done on this many separate days. */
export const HOMEWORK_TARGET_DAYS = 3;

type Progress = Record<string, string[]>; // cardId → ISO dates (YYYY-MM-DD)

/** The dates this card's homework has been completed on. */
export function daysFor(progress: Progress, cardId: string): string[] {
  return progress[cardId] ?? [];
}

/**
 * Log today's completion for a card. No-op if today is already logged for this
 * card, or it's already been done the target number of days. Resolves to an
 * error message if it couldn't be saved.
 */
export async function markHomeworkDay(cardId: string, today: string, progress?: Progress): Promise<string | null> {
  const days = progress?.[cardId] ?? [];
  if (days.includes(today) || days.length >= HOMEWORK_TARGET_DAYS) return null;
  try {
    await logHomeworkDay(cardId, today);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Couldn't save today's practice.";
  }
}

export function useHomeworkProgress(): Progress {
  return useReports().progress;
}
