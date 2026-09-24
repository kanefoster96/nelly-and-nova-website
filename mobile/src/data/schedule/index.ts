import { DAYS, type Cadence, type DayId, type DaySchedule } from "./types";
import { sampleWeek } from "./sample";

export { DAYS, spacesLeft } from "./types";
export type { DayId, DaySchedule, ScheduledDog } from "./types";

/** Trainer: the recurring week. */
export async function getWeekSchedule(): Promise<DaySchedule[]> {
  // TODO(backend): select * from schedule_slots join dogs ... order by day.
  return sampleWeek;
}

const JS_DAY: Record<DayId, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

/** Sessions from the next occurrence up to `months` ahead (same rule as the website). */
export function upcomingSessions(plan: { dayId: DayId; cadence: Cadence }, today: Date, months = 2): string[] {
  const start = new Date(today);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + months);
  const first = new Date(start);
  do first.setUTCDate(first.getUTCDate() + 1);
  while (first.getUTCDay() !== JS_DAY[plan.dayId]);
  const step = plan.cadence === "alternating" ? 14 : 7;
  const out: string[] = [];
  for (const d = new Date(first); d <= end; d.setUTCDate(d.getUTCDate() + step)) out.push(d.toISOString().slice(0, 10));
  return out;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "Thursday 21 August" for a YYYY-MM-DD. */
export function formatSessionDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const weekday = DAYS.find((x) => JS_DAY[x.id] === d.getUTCDay())?.label ?? "";
  return `${weekday} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Today's DayId (local time). */
export function todayDayId(now = new Date()): DayId {
  return (Object.keys(JS_DAY) as DayId[]).find((k) => JS_DAY[k] === now.getDay()) ?? "mon";
}

/** The next `count` dates from today (local), as { iso, day }. */
export function nextDates(count: number, now = new Date()): { iso: string; day: DayId }[] {
  const out: { iso: string; day: DayId }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ iso, day: todayDayId(d) });
  }
  return out;
}
