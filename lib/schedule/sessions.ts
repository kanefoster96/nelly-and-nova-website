/**
 * Upcoming sessions for a member's recurring plan.
 * ------------------------------------------------
 * A member trains on the same day every week (or every other week for
 * "alternating"), ongoing until cancelled. This generates the concrete session
 * dates from that pattern so the profile can list them and offer a reschedule.
 *
 * Pure + deterministic: pass `todayISO` in (computed once on the server) so the
 * same input always yields the same list — safe to run on server or client.
 */
import type { Cadence, DayId, DaySchedule } from "./types";
import { DAYS, dayLabel, spacesLeft } from "./types";

export type SessionDate = { date: string; day: DayId }; // date = YYYY-MM-DD

const JS_DAY: Record<DayId, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

/** Sessions from the next occurrence up to `months` ahead (default 2). */
export function upcomingSessions(
  plan: { dayId: DayId; cadence: Cadence },
  todayISO: string,
  months = 2
): SessionDate[] {
  const target = JS_DAY[plan.dayId];
  const start = new Date(todayISO);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + months);

  // First session = the next matching weekday strictly after today.
  const first = new Date(start);
  do {
    first.setUTCDate(first.getUTCDate() + 1);
  } while (first.getUTCDay() !== target);

  const step = plan.cadence === "alternating" ? 14 : 7;
  const out: SessionDate[] = [];
  for (const d = new Date(first); d <= end; d.setUTCDate(d.getUTCDate() + step)) {
    out.push({ date: d.toISOString().slice(0, 10), day: plan.dayId });
  }
  return out;
}

export type DayAvailability = { day: DayId; label: string; spaces: number };

/** Open days with their remaining spaces (days the business runs). */
export function availableDays(week: DaySchedule[]): DayAvailability[] {
  return week
    .filter((d) => d.capacity > 0)
    .map((d) => ({ day: d.day, label: dayLabel(d.day), spaces: spacesLeft(d) }));
}

/** Format a YYYY-MM-DD as e.g. "Thursday 21 August". */
export function formatSessionDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const weekday = DAYS.find((x) => JS_DAY[x.id] === d.getUTCDay())?.label ?? "";
  const month = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ][d.getUTCMonth()];
  return `${weekday} ${d.getUTCDate()} ${month}`;
}

/** The date of `day` within the same 7-day window as `sessionISO`. */
export function dateForDayInWeek(sessionISO: string, day: DayId): string {
  const base = new Date(`${sessionISO}T00:00:00Z`);
  const diff = JS_DAY[day] - base.getUTCDay();
  base.setUTCDate(base.getUTCDate() + diff);
  return base.toISOString().slice(0, 10);
}
