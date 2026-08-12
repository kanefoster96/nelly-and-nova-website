/**
 * Homework completion maths (pure).
 * ---------------------------------
 * A report card's homework must be done on 3 separate days, and only within 14
 * days of the card. A dog's all-time completion is the share of its report
 * cards that reached 3 days — counting only cards dated on/after any reset.
 */
import type { ReportCard } from "./types";
import { HOMEWORK_TARGET_DAYS } from "./progress";

/** How long after a report card the owner can still log homework. */
export const HOMEWORK_WINDOW_DAYS = 14;

/** The last day (YYYY-MM-DD) homework can be logged for a card. */
export function windowEnd(cardDateISO: string): string {
  const d = new Date(cardDateISO);
  d.setUTCDate(d.getUTCDate() + HOMEWORK_WINDOW_DAYS);
  return d.toISOString().slice(0, 10);
}

/** Is the card still inside its 14-day logging window on `todayISO` (YYYY-MM-DD)? */
export function isWindowOpen(cardDateISO: string, todayISO: string): boolean {
  return todayISO <= windowEnd(cardDateISO);
}

export type Completion = { percent: number; completed: number; total: number };

/**
 * All-time homework completion for a dog: the fraction of its eligible cards
 * whose homework reached the 3-day target. 100% when there are no eligible
 * cards (e.g. right after a reset).
 */
export function dogCompletion(
  cards: ReportCard[],
  progress: Record<string, string[]>,
  dogId: string | undefined,
  resetAt: string | undefined
): Completion {
  if (!dogId) return { percent: 100, completed: 0, total: 0 };
  const eligible = cards.filter(
    (c) => c.dogId === dogId && (!resetAt || c.date >= resetAt)
  );
  const total = eligible.length;
  if (total === 0) return { percent: 100, completed: 0, total: 0 };
  const completed = eligible.filter(
    (c) => (progress[c.id]?.length ?? 0) >= HOMEWORK_TARGET_DAYS
  ).length;
  return { percent: Math.round((completed / total) * 100), completed, total };
}
