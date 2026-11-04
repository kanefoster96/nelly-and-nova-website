import { postToSite } from "@/lib/site-api";
import { supabase } from "@/lib/supabase";

/**
 * The trainer's schedule, live from Supabase: regular Full Day Training
 * places (placements), one-off days and 1-1s (bookings) and meet & greets
 * (enquiries.meet_greet_at), laid out by date by nn_trainer_calendar (the
 * website's supabase/migrations/20261103070000_schedule.sql). Feeds the
 * trainer's Registers tab, the Calendar and a day's page. Trainers pass Row
 * Level Security on every table here; "Send onboarding" goes through the
 * website, because it sets up GoCardless and emails the owner.
 */

// ---------------------------------------------------------------------------
// Dates — all as "YYYY-MM-DD" in London, where the club is.
// ---------------------------------------------------------------------------

export type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";
const WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function toDate(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

/** Today in London. */
export function todayISO(): string {
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
}

export function addDays(iso: string, days: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. */
export function dayIndex(iso: string): number {
  return toDate(iso).getUTCDay();
}

export function isWeekday(iso: string): boolean {
  const i = dayIndex(iso);
  return i >= 1 && i <= 5;
}

/** The date itself on a weekday, else the Monday after. */
export function nextWeekday(iso: string): string {
  let d = iso;
  while (!isWeekday(d)) d = addDays(d, 1);
  return d;
}

/** "monday" for a weekday date, null at the weekend. */
export function weekdayOf(iso: string): Weekday | null {
  return isWeekday(iso) ? (WEEKDAY_NAMES[dayIndex(iso)] as Weekday) : null;
}

/** The Monday of the week a date is in (Sunday counts with the week before). */
export function mondayOf(iso: string): string {
  const i = dayIndex(iso);
  return addDays(iso, i === 0 ? -6 : 1 - i);
}

/** "Monday 9 November". */
export function formatDay(iso: string): string {
  const d = toDate(iso);
  return `${DAY_LABELS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Mon 9 Nov". */
export function formatShortDay(iso: string): string {
  const d = toDate(iso);
  return `${DAY_LABELS[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()} ${SHORT_MONTHS[d.getUTCMonth()]}`;
}

/** "2 – 6 Nov", "30 Nov – 4 Dec". */
export function formatWeekRange(monday: string): string {
  const a = toDate(monday);
  const b = toDate(addDays(monday, 4));
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${a.getUTCDate()} – ${b.getUTCDate()} ${SHORT_MONTHS[b.getUTCMonth()]}`
    : `${a.getUTCDate()} ${SHORT_MONTHS[a.getUTCMonth()]} – ${b.getUTCDate()} ${SHORT_MONTHS[b.getUTCMonth()]}`;
}

/** "Mondays" for a weekday. */
export function pluralDay(day: Weekday): string {
  return `${day[0].toUpperCase()}${day.slice(1)}s`;
}

/** "14:30" or "14:30:00" → "2:30pm". */
export function formatTime(time: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

// ---------------------------------------------------------------------------
// The calendar
// ---------------------------------------------------------------------------

export type CalendarKind = "full_day" | "full_day_one_off" | "one_to_one" | "meet_greet";

export type CalendarEntry = {
  date: string;
  kind: CalendarKind;
  /** "HH:MM:SS" for a 1-1 or a meet & greet. */
  startTime: string | null;
  /** placements.id (full_day), bookings.id (one-off, 1-1) or enquiries.id (meet & greet). */
  refId: string;
  accountId: string | null;
  /** Null while a held place is waiting for the owner to register their dog. */
  dogId: string | null;
  /** For a meet & greet, the dog names on the request. */
  dogName: string | null;
  dogPhoto: string | null;
  /** For a meet & greet, who asked. */
  ownerName: string | null;
  registered: boolean;
  holderName: string | null;
  enquiryId: string | null;
};

type CalendarRow = {
  on_date: string;
  kind: CalendarKind;
  start_time: string | null;
  ref_id: string;
  account_id: string | null;
  dog_id: string | null;
  dog_name: string | null;
  dog_photo: string | null;
  owner_name: string | null;
  registered: boolean | null;
  holder_name: string | null;
  enquiry_id: string | null;
};

/** The longest range nn_trainer_calendar will lay out at once. */
export const MAX_CALENDAR_DAYS = 400;

/** Everything from `from` to `to` (inclusive), in date order. */
export async function getTrainerCalendar(from: string, to: string): Promise<CalendarEntry[]> {
  const { data, error } = await supabase.rpc("nn_trainer_calendar", { p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return ((data ?? []) as CalendarRow[]).map((r) => ({
    date: String(r.on_date).slice(0, 10),
    kind: r.kind,
    startTime: r.start_time,
    refId: r.ref_id,
    accountId: r.account_id,
    dogId: r.dog_id,
    dogName: r.dog_name,
    dogPhoto: r.dog_photo,
    ownerName: r.owner_name,
    registered: !!r.registered,
    holderName: r.holder_name,
    enquiryId: r.enquiry_id,
  }));
}

/** A dog at Full Day Training that day: a regular place or a one-off. */
export function isFullDay(e: CalendarEntry): boolean {
  return e.kind === "full_day" || e.kind === "full_day_one_off";
}

/** What to call an entry: the dog, or who's holding the place. */
export function entryTitle(e: CalendarEntry): string {
  if (e.kind === "meet_greet") return e.ownerName || e.holderName || "Meet & greet";
  return e.dogName || e.holderName || e.ownerName || "Dog to be named";
}

export function groupByDate(entries: CalendarEntry[]): Map<string, CalendarEntry[]> {
  const out = new Map<string, CalendarEntry[]>();
  for (const e of entries) {
    const list = out.get(e.date);
    if (list) list.push(e);
    else out.set(e.date, [e]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Dogs and requests to add
// ---------------------------------------------------------------------------

export type RegisteredDog = {
  id: string;
  name: string;
  breed: string | null;
  photoUrl: string | null;
  accountId: string;
  ownerName: string | null;
};

async function ownerNames(accountIds: string[]): Promise<Record<string, string | null>> {
  const ids = [...new Set(accountIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const { data, error } = await supabase.from("profiles").select("id, owner_name").in("id", ids);
  if (error) throw new Error(error.message);
  const out: Record<string, string | null> = {};
  for (const p of (data ?? []) as { id: string; owner_name: string | null }[]) out[p.id] = p.owner_name;
  return out;
}

/** Every dog that's registered (waiver signed), A–Z, with its owner. */
export async function listRegisteredDogs(): Promise<RegisteredDog[]> {
  const { data, error } = await supabase
    .from("dogs")
    .select("id, name, breed, photo_url, account_id")
    .not("waiver_signed_at", "is", null)
    .order("name");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: string; name: string; breed: string | null; photo_url: string | null; account_id: string }[];
  const owners = await ownerNames(rows.map((r) => r.account_id));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    breed: r.breed,
    photoUrl: r.photo_url,
    accountId: r.account_id,
    ownerName: owners[r.account_id] ?? null,
  }));
}

export type OnboardingRequest = {
  id: string;
  name: string;
  email: string;
  dogNames: string | null;
  status: "new" | "meet_greet_booked" | "onboarding";
  meetGreetAt: string | null;
};

/** Meet & greet requests that are still open, newest first. */
export async function listOnboardingRequests(): Promise<OnboardingRequest[]> {
  const { data, error } = await supabase
    .from("enquiries")
    .select("id, name, email, dog_names, status, meet_greet_at")
    .in("status", ["new", "meet_greet_booked", "onboarding"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string; name: string; email: string; dog_names: string | null; status: OnboardingRequest["status"]; meet_greet_at: string | null }[]).map(
    (r) => ({ id: r.id, name: r.name, email: r.email, dogNames: r.dog_names, status: r.status, meetGreetAt: r.meet_greet_at }),
  );
}

// ---------------------------------------------------------------------------
// Changing a day
// ---------------------------------------------------------------------------

async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * Who a booking or a place is for: a customer's account and dog (the dog
 * may be still to come: it fills in once they register one), or a request
 * (held under their name until they sign up and register).
 */
export type BookingTarget = {
  accountId: string | null;
  dogId: string | null;
  enquiryId?: string | null;
  /** "Sam Taylor — Biscuit": shown until there's a dog. */
  holderName?: string | null;
};

function targetColumns(t: BookingTarget) {
  return {
    account_id: t.accountId,
    dog_id: t.dogId,
    enquiry_id: t.enquiryId ?? null,
    holder_name: t.dogId ? null : t.holderName?.trim() || null,
  };
}

/** A dog (or a held place) for just this day. Returns the booking's id. */
export async function addOneOffDay(date: string, target: BookingTarget): Promise<string> {
  const { data, error } = await supabase
    .from("bookings")
    .insert({ kind: "full_day", on_date: date, ...targetColumns(target), created_by: await myId() })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Couldn't add the day.");
  return (data as { id: string }).id;
}

/** A regular place on this date's weekday, from this date. Returns the place's id. */
export async function addRegularPlace(date: string, cadence: "weekly" | "alternating", target: BookingTarget): Promise<string> {
  const day = weekdayOf(date);
  if (!day) throw new Error("Full Day Training runs Monday to Friday.");
  const { data, error } = await supabase
    .from("placements")
    .insert({ day, cadence, start_on: date, ...targetColumns(target), created_by: await myId() })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Couldn't add the place.");
  return (data as { id: string }).id;
}

/** How long a 1-1 can run, in minutes. */
export const ONE_TO_ONE_MINUTES = [30, 45, 60, 90, 120];

/** "1 hr", "45 min", "1 hr 30". */
export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} hr${min % 60 ? ` ${min % 60}` : ""}`;
}

/** A 1-1 at a time, for a customer (and their dog) or a request. Returns the booking's id. */
export async function addOneToOne(input: {
  date: string;
  /** "HH:MM". */
  time: string;
  durationMin?: number | null;
  target: BookingTarget;
  notes?: string | null;
}): Promise<string> {
  const row: Record<string, unknown> = {
    kind: "one_to_one",
    on_date: input.date,
    start_time: input.time,
    ...targetColumns(input.target),
    notes: input.notes?.trim() || null,
    created_by: await myId(),
  };
  if (input.durationMin) row.duration_min = input.durationMin;
  let { data, error } = await supabase.from("bookings").insert(row).select("id").single();
  if (error && /duration_min/.test(error.message)) {
    // Before the duration column is there: book it without.
    delete row.duration_min;
    ({ data, error } = await supabase.from("bookings").insert(row).select("id").single());
  }
  if (error || !data) throw new Error(error?.message ?? "Couldn't add the 1-1.");
  return (data as { id: string }).id;
}

/** "YYYY-MM-DD" + "HH:MM" in London, as an ISO timestamp. */
export function londonISO(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  // London's offset at that moment (0 in winter, +1 in summer).
  let offset = 0;
  try {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(guess));
    const lh = Number(f.find((p) => p.type === "hour")?.value ?? h);
    const lm = Number(f.find((p) => p.type === "minute")?.value ?? min);
    offset = ((lh * 60 + lm - (h * 60 + min) + 1440 + 720) % 1440) - 720;
  } catch {
    offset = -new Date(guess).getTimezoneOffset();
  }
  return new Date(guess - offset * 60_000).toISOString();
}

/**
 * Book (or move) a meet & greet from a day: on a request, or for a
 * customer (their open request, else a new one on their account), with
 * where it is and a note (nn_trainer_book_meet_greet). Returns the
 * request's id: the meet & greet shows on the calendar, on Today, and in
 * the owner's app.
 */
export async function bookDayMeetGreet(input: {
  date: string;
  time: string;
  enquiryId?: string | null;
  accountId?: string | null;
  dogId?: string | null;
  address: string;
  notes: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("nn_trainer_book_meet_greet", {
    p_at: londonISO(input.date, input.time),
    p_enquiry_id: input.enquiryId ?? null,
    p_account_id: input.enquiryId ? null : (input.accountId ?? null),
    p_dog_id: input.dogId ?? null,
    p_address: input.address.trim() || null,
    p_notes: input.notes.trim() || null,
  });
  if (error || !data) throw new Error(error?.message ?? "Couldn't book the meet & greet.");
  return data as string;
}

export type BookedKind = "one_to_one" | "full_day_one_off" | "full_day" | "meet_greet";

/**
 * Tell the owner what's been booked (a notification and a push, through
 * the website: app/api/schedule/booked). For a meet & greet, `email` also
 * emails them the day and time. Never throws: the booking's already made.
 */
export async function notifyBooked(kind: BookedKind, id: string, opts: { email?: boolean; notify?: boolean } = {}): Promise<{ notified: boolean; emailed: boolean }> {
  try {
    const res = await postToSite<{ notified?: boolean; emailed?: boolean }>(
      "/api/schedule/booked",
      { kind, id, email: !!opts.email, notify: opts.notify !== false },
      "Couldn't let them know.",
    );
    return { notified: !!res.notified, emailed: !!res.emailed };
  } catch {
    return { notified: false, emailed: false };
  }
}

/** Cancel a one-off day or a 1-1. */
export async function cancelBooking(bookingId: string): Promise<void> {
  const { error } = await supabase.from("bookings").update({ cancelled_at: new Date().toISOString() }).eq("id", bookingId);
  if (error) throw new Error(error.message);
}

/**
 * Take a regular place off the calendar from `date` on: it ends the day
 * before. A place that would end before it began (removed on its first
 * day) is deleted instead.
 */
export async function endRegularPlace(placementId: string, date: string): Promise<void> {
  const { data, error: loadError } = await supabase.from("placements").select("start_on").eq("id", placementId).maybeSingle();
  if (loadError) throw new Error(loadError.message);
  const startOn = (data as { start_on: string } | null)?.start_on;
  if (startOn && startOn >= date) {
    const { error } = await supabase.from("placements").delete().eq("id", placementId);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabase.from("placements").update({ end_on: addDays(date, -1) }).eq("id", placementId);
  if (error) throw new Error(error.message);
}

export type OnboardingResult = { joinUrl: string | null; emailed: boolean; messaged: boolean };

/**
 * "Start onboarding" for a meet & greet request (the Onboarding board, or
 * Send onboarding on a day): the website gives the request a join link and
 * a GoCardless set-up and emails it to the owner (and their chat, if they
 * have an account). With `place`, it also holds a regular place, filled in
 * with their dog once they register. Pressing it again re-sends the link.
 */
export async function startOnboarding(enquiryId: string, place?: { day: Weekday; cadence: "weekly" | "alternating"; startOn: string }): Promise<OnboardingResult> {
  const body = await postToSite<{ joinUrl?: string; emailed?: boolean; messaged?: boolean }>(
    "/api/onboarding/start",
    place ? { enquiryId, place } : { enquiryId },
    "Couldn't send the onboarding link.",
  );
  return { joinUrl: body.joinUrl ?? null, emailed: !!body.emailed, messaged: !!body.messaged };
}

/**
 * "Send onboarding" from a day: starts onboarding and holds a regular place
 * on this date's weekday from this date. The held place fills in with their
 * dog once they register, so nothing else is written here.
 */
export async function sendOnboarding(enquiryId: string, date: string, cadence: "weekly" | "alternating"): Promise<OnboardingResult> {
  const day = weekdayOf(date);
  if (!day) throw new Error("Full Day Training runs Monday to Friday.");
  return startOnboarding(enquiryId, { day, cadence, startOn: date });
}

// ---------------------------------------------------------------------------
// A dog's page (the record itself: data/trainer-dog.ts)
// ---------------------------------------------------------------------------

/** The owner's chat (made if it doesn't exist yet), for Message on a dog's page. */
export async function conversationForAccount(accountId: string): Promise<string> {
  const { data, error } = await supabase.rpc("nn_chat_conversation_for", { p_account_id: accountId });
  if (error || !data) throw new Error(error?.message ?? "Couldn't open their chat.");
  return data as string;
}
