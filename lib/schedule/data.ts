/**
 * Data-access seam for the weekly schedule (admin).
 * Intended backend (Supabase):
 *   - getWeekSchedule() → select from `schedule_slots` joined with `dogs`
 *   - getDaySchedule(day) → the same, filtered to one day
 *   - holdSlot(dogId, day) → insert a 'held' slot during onboarding
 *   - confirmSlot(dogId) → set status = 'permanent' once payment + waiver done
 */
import type { DayId, DaySchedule } from "./types";
import { sampleWeek } from "./sample";

export async function getWeekSchedule(): Promise<DaySchedule[]> {
  // TODO(backend): select * from schedule_slots join dogs ... order by day
  return sampleWeek;
}

export async function getDaySchedule(day: DayId): Promise<DaySchedule> {
  const week = await getWeekSchedule();
  return (
    week.find((d) => d.day === day) ?? { day, capacity: 0, dogs: [] }
  );
}
