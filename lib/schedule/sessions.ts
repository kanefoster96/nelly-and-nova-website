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
import type { Cadence, DayId, DaySchedule, ScheduledDog } from "./types";
import { DAYS, dayIdFromDate, dayLabel, spacesLeft } from "./types";
import type { RescheduleRequest } from "@/lib/reschedule/types";

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

/** Open days with their remaining spaces (days the business runs) — admin view. */
export function availableDays(week: DaySchedule[]): DayAvailability[] {
  return week
    .filter((d) => d.capacity > 0)
    .map((d) => ({ day: d.day, label: dayLabel(d.day), spaces: spacesLeft(d) }));
}

export type MemberDay = { day: DayId; label: string };

/**
 * Days a member may book onto — those with space (5 or fewer dogs, and under
 * capacity). Deliberately omits the dog count so members only see availability,
 * never how full a day is.
 */
export function memberDays(week: DaySchedule[]): MemberDay[] {
  return week
    .filter((d) => d.capacity > 0 && d.dogs.length < d.capacity && d.dogs.length <= 5)
    .map((d) => ({ day: d.day, label: dayLabel(d.day) }));
}

/** The next occurrence of `day` strictly after `fromISO`. */
export function nextDateForDay(fromISO: string, day: DayId): string {
  const target = JS_DAY[day];
  const d = new Date(`${fromISO}T00:00:00Z`);
  do {
    d.setUTCDate(d.getUTCDate() + 1);
  } while (d.getUTCDay() !== target);
  return d.toISOString().slice(0, 10);
}

/** At-a-glance fullness colour for a day's dot: green ≤3, orange 4–5, red full/6. */
export function dotColor(count: number, capacity: number): "green" | "orange" | "red" | null {
  if (count <= 0) return null;
  if (count >= 6 || count >= capacity) return "red";
  if (count >= 4) return "orange";
  return "green";
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

export function dayIdFromISO(iso: string): DayId {
  return dayIdFromDate(new Date(`${iso}T00:00:00Z`));
}

// --- calendar (month grid) ------------------------------------------------

export type CalendarCell = { iso: string; day: number; inMonth: boolean; dayId: DayId };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthName(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

/** Weeks (Mon–Sun) of dates covering `month`, with leading/trailing days. */
export function monthGrid(year: number, month: number): CalendarCell[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7; // days before the 1st (Mon=0)
  const gridStart = new Date(Date.UTC(year, month, 1 - lead));
  const weeks: CalendarCell[][] = [];
  const cur = new Date(gridStart);
  for (let w = 0; w < 6; w++) {
    const week: CalendarCell[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({
        iso: cur.toISOString().slice(0, 10),
        day: cur.getUTCDate(),
        inMonth: cur.getUTCMonth() === month,
        dayId: dayIdFromDate(cur),
      });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    weeks.push(week);
    // Stop after we've covered the month (avoid a trailing all-next-month row).
    if (cur.getUTCMonth() !== month && week.some((c) => c.inMonth) === false && w >= 4) break;
  }
  return weeks;
}

// --- dogs on a specific date (recurring + one-off moves) ------------------

export type DogOnDate = { dog: ScheduledDog; movedInFrom?: string };

const approvedMoves = (reschedules: RescheduleRequest[]) =>
  reschedules.filter((r) => r.status === "approved");

/**
 * The dogs training on `dateISO`: the recurring dogs for that weekday, minus any
 * moved away that day, plus any moved onto it. (Alternating-week parity is
 * simplified — every matching weekday is treated as a session.)
 */
export function dogsForDate(
  dateISO: string,
  week: DaySchedule[],
  reschedules: RescheduleRequest[]
): DogOnDate[] {
  const day = dayIdFromISO(dateISO);
  // A recurring dog only runs on/after its start date (if it has one).
  const base = (week.find((d) => d.day === day)?.dogs ?? []).filter(
    (dg) => !dg.startDate || dg.startDate <= dateISO
  );
  const moves = approvedMoves(reschedules);
  const movedAway = new Set(moves.filter((r) => r.sessionDate === dateISO).map((r) => r.dogId));
  const dogById = new Map(week.flatMap((d) => d.dogs).map((dg) => [dg.id, dg]));

  const staying: DogOnDate[] = base.filter((dg) => !movedAway.has(dg.id)).map((dog) => ({ dog }));
  const movedIn: DogOnDate[] = moves
    .filter((r) => r.toDate === dateISO)
    .map((r) => ({
      dog:
        dogById.get(r.dogId) ??
        ({
          id: r.dogId,
          name: r.dogName,
          ownerName: r.ownerName,
          photo: "/placeholders/dog-avatar-01.svg",
          cadence: "weekly",
          status: "permanent",
        } as ScheduledDog),
      movedInFrom: r.sessionDate,
    }));

  return [...staying, ...movedIn];
}

export function spacesOnDate(
  dateISO: string,
  week: DaySchedule[],
  reschedules: RescheduleRequest[]
): number {
  const day = dayIdFromISO(dateISO);
  const daySched = week.find((d) => d.day === day);
  if (!daySched || daySched.capacity === 0) return 0;
  return Math.max(0, daySched.capacity - dogsForDate(dateISO, week, reschedules).length);
}
