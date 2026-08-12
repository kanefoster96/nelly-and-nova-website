/**
 * Recurring charge schedule. A member's GoCardless subscription charges the day
 * before each session — the same day and time every week (or every other week
 * for alternating). Rescheduling an individual session does NOT change this
 * recurring charge; only extra sessions add a separate charge, taken when the
 * booking is confirmed.
 */
import { dayBefore, dayLabel, type Cadence, type DayId } from "@/lib/schedule/types";

/** The charge date for a session — the day before it. */
export function chargeDateFor(sessionISO: string): string {
  const d = new Date(`${sessionISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** The weekday charges land on (day before the session day), e.g. "Wednesday". */
export function chargeDayLabel(sessionDay: DayId): string {
  return dayLabel(dayBefore(sessionDay));
}

/** A member-friendly sentence describing when they're charged. */
export function describeChargeSchedule(sessionDay: DayId, cadence: Cadence): string {
  const when = cadence === "alternating" ? "every other week" : "every week";
  return `Payment is taken ${when} on ${dayLabel(dayBefore(sessionDay))}s — the day before your session.`;
}
