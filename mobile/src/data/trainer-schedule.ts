import { config } from "@/lib/config";
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

/** A registered dog for just this day. */
export async function addOneOffDay(date: string, dog: Pick<RegisteredDog, "id" | "accountId">): Promise<void> {
  const { error } = await supabase.from("bookings").insert({
    kind: "full_day",
    on_date: date,
    account_id: dog.accountId,
    dog_id: dog.id,
    created_by: await myId(),
  });
  if (error) throw new Error(error.message);
}

/** A registered dog's regular place on this date's weekday, from this date. */
export async function addRegularPlace(date: string, cadence: "weekly" | "alternating", dog: Pick<RegisteredDog, "id" | "accountId">): Promise<void> {
  const day = weekdayOf(date);
  if (!day) throw new Error("Full Day Training runs Monday to Friday.");
  const { error } = await supabase.from("placements").insert({
    day,
    cadence,
    start_on: date,
    account_id: dog.accountId,
    dog_id: dog.id,
    created_by: await myId(),
  });
  if (error) throw new Error(error.message);
}

/** A 1-1 at a time: for a registered dog, or a name for someone not signed up yet. */
export async function addOneToOne(input: {
  date: string;
  /** "HH:MM". */
  time: string;
  dog?: Pick<RegisteredDog, "id" | "accountId"> | null;
  holderName?: string | null;
  notes?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("bookings").insert({
    kind: "one_to_one",
    on_date: input.date,
    start_time: input.time,
    account_id: input.dog?.accountId ?? null,
    dog_id: input.dog?.id ?? null,
    holder_name: input.dog ? null : input.holderName?.trim() || null,
    notes: input.notes?.trim() || null,
    created_by: await myId(),
  });
  if (error) throw new Error(error.message);
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
 * "Send onboarding" from a day: the website gives the request a join link
 * and a GoCardless set-up, emails it to the owner (and their chat, if they
 * have an account), and holds a regular place on this date's weekday from
 * this date. The held place fills in with their dog once they register, so
 * nothing else is written here.
 */
export async function sendOnboarding(enquiryId: string, date: string, cadence: "weekly" | "alternating"): Promise<OnboardingResult> {
  const day = weekdayOf(date);
  if (!day) throw new Error("Full Day Training runs Monday to Friday.");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  let res: Response;
  try {
    res = await fetch(new URL("/api/onboarding/start", config.siteUrl).toString(), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ enquiryId, place: { day, cadence, startOn: date } }),
    });
  } catch {
    throw new Error("Couldn't reach the website. Check your connection and try again.");
  }
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; joinUrl?: string; emailed?: boolean; messaged?: boolean; error?: string };
  if (!res.ok || body.error) throw new Error(body.error || "Couldn't send the onboarding link.");
  return { joinUrl: body.joinUrl ?? null, emailed: !!body.emailed, messaged: !!body.messaged };
}

// ---------------------------------------------------------------------------
// A dog's page
// ---------------------------------------------------------------------------

export type DogDetail = {
  id: string;
  name: string;
  breed: string | null;
  sex: string | null;
  dateOfBirth: string | null;
  photoUrl: string | null;
  waiverSignedAt: string | null;
  medicalConditions: string | null;
  allergies: string | null;
  notes: string | null;
  vetName: string | null;
  vetPhone: string | null;
  owner: { id: string; name: string | null; email: string | null; phone: string | null; avatarUrl: string | null } | null;
  /** Regular places still running. */
  places: { id: string; day: Weekday; cadence: "weekly" | "alternating"; startOn: string; endOn: string | null }[];
  /** One-off days and 1-1s from today on. */
  bookings: { id: string; kind: "full_day" | "one_to_one"; date: string; startTime: string | null }[];
};

export async function getDogDetail(dogId: string): Promise<DogDetail | null> {
  const { data: dog, error } = await supabase
    .from("dogs")
    .select("id, name, breed, sex, date_of_birth, photo_url, waiver_signed_at, medical_conditions, allergies, notes, vet_name, vet_phone, account_id")
    .eq("id", dogId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!dog) return null;
  const d = dog as {
    id: string;
    name: string;
    breed: string | null;
    sex: string | null;
    date_of_birth: string | null;
    photo_url: string | null;
    waiver_signed_at: string | null;
    medical_conditions: string | null;
    allergies: string | null;
    notes: string | null;
    vet_name: string | null;
    vet_phone: string | null;
    account_id: string | null;
  };
  const today = todayISO();
  const [owner, places, bookings] = await Promise.all([
    d.account_id
      ? supabase.from("profiles").select("id, owner_name, email, phone, avatar_url").eq("id", d.account_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("placements").select("id, day, cadence, start_on, end_on").eq("dog_id", dogId).or(`end_on.is.null,end_on.gte.${today}`).order("start_on"),
    supabase
      .from("bookings")
      .select("id, kind, on_date, start_time")
      .eq("dog_id", dogId)
      .is("cancelled_at", null)
      .gte("on_date", today)
      .order("on_date")
      .limit(20),
  ]);
  const o = owner.data as { id: string; owner_name: string | null; email: string | null; phone: string | null; avatar_url: string | null } | null;
  return {
    id: d.id,
    name: d.name,
    breed: d.breed,
    sex: d.sex,
    dateOfBirth: d.date_of_birth,
    photoUrl: d.photo_url,
    waiverSignedAt: d.waiver_signed_at,
    medicalConditions: d.medical_conditions,
    allergies: d.allergies,
    notes: d.notes,
    vetName: d.vet_name,
    vetPhone: d.vet_phone,
    owner: o ? { id: o.id, name: o.owner_name, email: o.email, phone: o.phone, avatarUrl: o.avatar_url } : null,
    places: ((places.data ?? []) as { id: string; day: Weekday; cadence: "weekly" | "alternating"; start_on: string; end_on: string | null }[]).map((p) => ({
      id: p.id,
      day: p.day,
      cadence: p.cadence,
      startOn: p.start_on,
      endOn: p.end_on,
    })),
    bookings: ((bookings.data ?? []) as { id: string; kind: "full_day" | "one_to_one"; on_date: string; start_time: string | null }[]).map((b) => ({
      id: b.id,
      kind: b.kind,
      date: b.on_date,
      startTime: b.start_time,
    })),
  };
}

/** The owner's chat (made if it doesn't exist yet), for Message on a dog's page. */
export async function conversationForAccount(accountId: string): Promise<string> {
  const { data, error } = await supabase.rpc("nn_chat_conversation_for", { p_account_id: accountId });
  if (error || !data) throw new Error(error?.message ?? "Couldn't open their chat.");
  return data as string;
}
