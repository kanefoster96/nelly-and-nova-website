import { supabase } from "@/lib/supabase";

/**
 * The register, kept from the trainer's Today tab in `attendance`
 * (supabase/migrations/20261104100000_trainer_flow.sql): a Full Day dog is
 * present (tapping "Picked up") or absent; a 1-1 is done or a no show.
 * Marks go through nn_mark_attendance (trainers only); owners can read
 * their own but aren't told.
 */

export type FullDayMark = "present" | "absent";
export type OneToOneMark = "done" | "no_show";

export type DayRegister = {
  /** Full Day dogs by dog id. */
  fullDay: Map<string, FullDayMark>;
  /** 1-1s by booking id. */
  oneToOne: Map<string, OneToOneMark>;
};

export const EMPTY_REGISTER: DayRegister = { fullDay: new Map(), oneToOne: new Map() };

export async function getRegister(date: string): Promise<DayRegister> {
  const { data, error } = await supabase.from("attendance").select("session, dog_id, booking_id, status").eq("on_date", date);
  if (error) throw new Error(error.message);
  const out: DayRegister = { fullDay: new Map(), oneToOne: new Map() };
  for (const r of (data ?? []) as { session: string; dog_id: string | null; booking_id: string | null; status: string }[]) {
    if (r.session === "full_day" && r.dog_id) out.fullDay.set(r.dog_id, r.status as FullDayMark);
    if (r.session === "one_to_one" && r.booking_id) out.oneToOne.set(r.booking_id, r.status as OneToOneMark);
  }
  return out;
}

/** Mark (or, with null, clear) a Full Day dog on a date. */
export async function markFullDay(date: string, dogId: string, status: FullDayMark | null): Promise<void> {
  const { error } = await supabase.rpc("nn_mark_attendance", { p_date: date, p_dog_id: dogId, p_status: status, p_booking_id: null });
  if (error) throw new Error(error.message.includes("nn_mark_attendance") ? "The register isn't set up yet." : error.message);
}

/** Mark (or clear) a 1-1. */
export async function markOneToOne(bookingId: string, status: OneToOneMark | null, dogId?: string | null): Promise<void> {
  const { error } = await supabase.rpc("nn_mark_attendance", { p_date: null, p_dog_id: dogId ?? null, p_status: status, p_booking_id: bookingId });
  if (error) throw new Error(error.message.includes("nn_mark_attendance") ? "The register isn't set up yet." : error.message);
}

/**
 * The dogs who were in on a date, in the order they came: Full Day dogs
 * marked present, then 1-1s marked done (with a dog). For the end-of-day
 * reports.
 */
export async function presentDogs(date: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("attendance")
    .select("session, dog_id, status, marked_at")
    .eq("on_date", date)
    .in("status", ["present", "done"])
    .order("marked_at");
  if (error) throw new Error(error.message);
  const ids: string[] = [];
  for (const r of (data ?? []) as { session: string; dog_id: string | null }[]) {
    if (r.dog_id && !ids.includes(r.dog_id)) ids.push(r.dog_id);
  }
  return ids;
}
