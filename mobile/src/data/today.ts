import { addressLine } from "@/lib/contact";
import { supabase } from "@/lib/supabase";

import { getDayCancellations, listRequests, requestsForDate, type DayCancellation, type SessionRequest } from "./sessions";
import { getTrainerCalendar, isFullDay, type CalendarEntry } from "./trainer-schedule";

/**
 * The trainer's Today tab: one day's dogs from nn_trainer_calendar, with
 * what a trainer needs at a glance for each — breed, owner, their pick-up
 * address and number, and flags: not registered (no signed waiver), unpaid
 * (a one-off or 1-1 still to pay), medical info, and a request touching
 * the day. Plus the day's cancellations.
 */

export type TodayDog = {
  entry: CalendarEntry;
  breed: string | null;
  ownerName: string | null;
  phone: string | null;
  address: string | null;
  medical: string | null;
  unpaid: boolean;
  request: SessionRequest | null;
};

export type TodayData = {
  date: string;
  /** Full Day Training dogs (regular and one-off), one per dog; held places at the end. */
  fullDay: TodayDog[];
  oneToOnes: TodayDog[];
  meetGreets: CalendarEntry[];
  cancellations: DayCancellation[];
  /** Open requests for the day that aren't for a dog already on it. */
  otherRequests: SessionRequest[];
};

export async function getToday(date: string): Promise<TodayData> {
  const [entries, open, cancellations] = await Promise.all([
    getTrainerCalendar(date, date),
    listRequests({ open: true, withOwners: true }).catch(() => [] as SessionRequest[]),
    getDayCancellations(date).catch(() => [] as DayCancellation[]),
  ]);
  const requests = requestsForDate(open, date);

  const dogIds = [...new Set(entries.map((e) => e.dogId).filter((x): x is string => !!x))];
  const accountIds = [...new Set(entries.map((e) => e.accountId).filter((x): x is string => !!x))];
  const bookingIds = entries.filter((e) => e.kind === "full_day_one_off" || e.kind === "one_to_one").map((e) => e.refId);

  const [dogs, owners, bookings] = await Promise.all([
    dogIds.length ? supabase.from("dogs").select("id, breed, medical_conditions, allergies").in("id", dogIds) : Promise.resolve({ data: [] }),
    accountIds.length
      ? supabase.from("profiles").select("id, owner_name, phone, pickup_address, address, city, postcode").in("id", accountIds)
      : Promise.resolve({ data: [] }),
    bookingIds.length ? supabase.from("bookings").select("id, payment_status").in("id", bookingIds) : Promise.resolve({ data: [] }),
  ]);
  const dogById = new Map(((dogs.data ?? []) as { id: string; breed: string | null; medical_conditions: string | null; allergies: string | null }[]).map((d) => [d.id, d]));
  const ownerById = new Map(
    ((owners.data ?? []) as { id: string; owner_name: string | null; phone: string | null; pickup_address: string | null; address: string | null; city: string | null; postcode: string | null }[]).map((p) => [p.id, p]),
  );
  const unpaid = new Set(((bookings.data ?? []) as { id: string; payment_status: string | null }[]).filter((b) => b.payment_status === "unpaid" || b.payment_status === "failed").map((b) => b.id));

  const toDog = (e: CalendarEntry): TodayDog => {
    const dog = e.dogId ? dogById.get(e.dogId) : undefined;
    const owner = e.accountId ? ownerById.get(e.accountId) : undefined;
    const medical = [dog?.medical_conditions?.trim(), dog?.allergies?.trim() ? `Allergies: ${dog.allergies.trim()}` : null].filter(Boolean).join(" · ");
    return {
      entry: e,
      breed: dog?.breed?.trim() || null,
      ownerName: owner?.owner_name ?? e.ownerName,
      phone: owner?.phone?.trim() || null,
      address: addressLine(owner),
      medical: medical || null,
      unpaid: unpaid.has(e.refId),
      request: (e.dogId && requests.find((r) => r.dogId === e.dogId)) || null,
    };
  };

  // One row per dog at Full Day (a regular place and a one-off on the same day show once).
  const seen = new Set<string>();
  const fullDay: TodayDog[] = [];
  for (const e of entries.filter(isFullDay)) {
    if (e.dogId) {
      if (seen.has(e.dogId)) continue;
      seen.add(e.dogId);
    }
    fullDay.push(toDog(e));
  }
  const onDay = new Set(entries.map((e) => e.dogId).filter(Boolean));

  return {
    date,
    fullDay,
    oneToOnes: entries.filter((e) => e.kind === "one_to_one").map(toDog),
    meetGreets: entries.filter((e) => e.kind === "meet_greet"),
    cancellations,
    otherRequests: requests.filter((r) => !onDay.has(r.dogId)),
  };
}
