/**
 * Data-access seam for the weekly schedule (admin).
 * Intended backend (Supabase):
 *   - getWeekSchedule() → select from `schedule_slots` joined with `dogs`
 *   - getDaySchedule(day) → the same, filtered to one day
 *   - holdSlot(dogId, day) → insert a 'held' slot during onboarding
 *   - confirmSlot(dogId) → set status = 'permanent' once payment + waiver done
 */
import type { DayId, DaySchedule, ScheduledDog } from "./types";
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

/**
 * Hold a slot for a customer during onboarding (provisional booking).
 * TODO(backend): insert into schedule_slots (day, dog_id, status='held').
 */
export async function holdSlot(day: DayId, dog: ScheduledDog): Promise<void> {
  console.log(`[schedule] held ${dog.name} on ${day} (scaffold)`);
}

/**
 * Confirm a held slot once payment + waiver are done → permanent booking.
 * TODO(backend): update schedule_slots set status='permanent' where dog_id=$1
 * (guard: payment received and waiver signed).
 */
export async function confirmSlot(dogId: string): Promise<void> {
  console.log(`[schedule] confirmed ${dogId} → permanent (scaffold)`);
}

/**
 * Release a slot back to the day's capacity (declined / withdrawn onboarding).
 * TODO(backend): delete from schedule_slots where dog_id=$1.
 */
export async function releaseSlot(dogId: string): Promise<void> {
  console.log(`[schedule] released ${dogId} (scaffold)`);
}

/** Move a member's recurring slot to a different weekday. */
export async function reassignSlotDay(dogId: string, day: DayId): Promise<void> {
  // TODO(backend): update schedule_slots set day = $2 where dog_id = $1, and
  // re-point the GoCardless subscription's charge day (day before the new day).
  console.log(`[schedule] reassigned ${dogId} → ${day} (scaffold)`);
}
