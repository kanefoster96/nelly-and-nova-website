/**
 * Payment history (derived, scaffold).
 * ------------------------------------
 * There's no stored ledger yet — a session's status is computed per (dog, date)
 * on demand. To show "every payment taken", we reconstruct the charge history
 * from the roster: each recurring member is charged the day before every
 * session, so we walk each member's training day back over the past weeks and
 * emit one record per charge already taken. Extra/one-off sessions (from the
 * reschedule store) are charged on booking, so each becomes a record too.
 * TODO(backend): replace with a real payments table from GoCardless webhooks.
 */
import type { DaySchedule } from "@/lib/schedule/types";
import type { RescheduleRequest } from "@/lib/reschedule/types";
import { chargeDateFor } from "./schedule";
import { recurringPrice, extraSessionPrice } from "./pricing";

const JS_DAY: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

export type PaymentRecord = {
  id: string; // `${dogId}:${sessionDate}` for sessions, request id for extras
  dogId: string;
  dogName: string;
  ownerName: string;
  email?: string;
  kind: "session" | "extra";
  service?: string; // extra sessions only
  sessionDate: string; // the session the charge is for (YYYY-MM-DD)
  chargeDate: string; // the day the money was taken (YYYY-MM-DD)
  amount: number; // pounds
};

/**
 * Every charge taken up to `todayISO`, newest charge first. `weeksBack` bounds
 * how far the recurring history goes.
 */
export function paymentHistory(
  week: DaySchedule[],
  reschedules: RescheduleRequest[],
  todayISO: string,
  weeksBack = 10
): PaymentRecord[] {
  const today = todayISO.slice(0, 10);
  const records: PaymentRecord[] = [];
  const recAmount = recurringPrice().amount;

  for (const day of week) {
    const target = JS_DAY[day.day];
    for (const dog of day.dogs) {
      // Walk back from the most recent occurrence of this weekday.
      const d = new Date(`${today}T00:00:00Z`);
      while (d.getUTCDay() !== target) d.setUTCDate(d.getUTCDate() - 1);
      const step = dog.cadence === "alternating" ? 14 : 7;
      for (let i = 0; i < weeksBack; i++) {
        const sessionDate = d.toISOString().slice(0, 10);
        const chargeDate = chargeDateFor(sessionDate);
        // Only charges already taken, and not before the member's start date.
        if (chargeDate <= today && (!dog.startDate || sessionDate >= dog.startDate)) {
          records.push({
            id: `${dog.id}:${sessionDate}`,
            dogId: dog.id,
            dogName: dog.name,
            ownerName: dog.ownerName,
            email: dog.email,
            kind: "session",
            sessionDate,
            chargeDate,
            amount: recAmount,
          });
        }
        d.setUTCDate(d.getUTCDate() - step);
      }
    }
  }

  // Extra / one-off sessions — charged when the booking is confirmed.
  for (const r of reschedules) {
    if (r.kind !== "extra" || r.status === "rejected") continue;
    records.push({
      id: r.id,
      dogId: r.dogId,
      dogName: r.dogName,
      ownerName: r.ownerName,
      email: r.email,
      kind: "extra",
      service: r.service,
      sessionDate: r.toDate,
      chargeDate: r.createdAt.slice(0, 10),
      amount: extraSessionPrice(r.service ?? ""),
    });
  }

  records.sort((a, b) => (a.chargeDate < b.chargeDate ? 1 : a.chargeDate > b.chargeDate ? -1 : 0));
  return records;
}
