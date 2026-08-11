/**
 * Weekly training schedule (admin).
 * ---------------------------------
 * Dogs are booked onto a day of the week, either every week or on alternating
 * weeks. During onboarding a slot can be *held* for a customer; once payment
 * and the waiver are complete it becomes *permanent*. Each day has a capacity
 * so admins can see the spaces left when allocating a slot.
 */

export type DayId = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const DAYS: { id: DayId; label: string; short: string }[] = [
  { id: "mon", label: "Monday", short: "Mon" },
  { id: "tue", label: "Tuesday", short: "Tue" },
  { id: "wed", label: "Wednesday", short: "Wed" },
  { id: "thu", label: "Thursday", short: "Thu" },
  { id: "fri", label: "Friday", short: "Fri" },
  { id: "sat", label: "Saturday", short: "Sat" },
  { id: "sun", label: "Sunday", short: "Sun" },
];

/** Every week, or every other week (parity picks which week). */
export type Cadence = "weekly" | "alternating";

/** A held slot is provisional (onboarding); permanent is fully signed up. */
export type SlotStatus = "held" | "permanent";

export type ScheduledDog = {
  id: string; // dog id
  name: string;
  photo: string;
  ownerName: string;
  cadence: Cadence;
  /** For alternating dogs — which week they're in ("A" or "B"). */
  weekParity?: "A" | "B";
  status: SlotStatus;
};

export type DaySchedule = {
  day: DayId;
  capacity: number;
  dogs: ScheduledDog[];
};

/** Map a JS weekday (0=Sun..6=Sat) to our DayId. */
export function dayIdFromDate(date: Date): DayId {
  const map: DayId[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[date.getUTCDay()];
}

export function dayLabel(id: DayId): string {
  return DAYS.find((d) => d.id === id)?.label ?? id;
}

export function spacesLeft(day: DaySchedule): number {
  return Math.max(0, day.capacity - day.dogs.length);
}
