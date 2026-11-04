/**
 * Homework completion maths (pure).
 * ---------------------------------
 * A report card's homework is complete once done on 3 different days (UK
 * dates, once a day). It never expires: it stays to do until then. A dog's
 * all-time completion is the share of its report cards that reached 3 days —
 * counting only cards dated on/after any reset.
 */
import type { ReportCard } from "./types";
import { HOMEWORK_TARGET_DAYS } from "./progress";

/** The date `months` before `todayISO` (YYYY-MM-DD) — e.g. a 6-month window. */
export function monthsAgoISO(todayISO: string, months: number): string {
  const d = new Date(todayISO);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
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
