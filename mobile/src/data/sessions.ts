import { config, sessionPrices } from "@/lib/config";
import { supabase } from "@/lib/supabase";

/**
 * A dog's sessions and the changes to them: cancelling (instant), requests
 * the trainer decides (a replacement day, an extra Full Day or a 1-1, a new
 * regular day, a switch), how full each day is, and session payments.
 * The database does the work in SECURITY DEFINER functions (the website's
 * supabase/migrations/20261104050000_dog_profile.sql); each hands back the
 * notifications it made, which the website pushes (app/api/sessions/push).
 * The website's trainer page has the same in lib/sessions/client.ts.
 */

// ---------------------------------------------------------------------------
// Dates, as "YYYY-MM-DD" in London.
// ---------------------------------------------------------------------------

export type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";
export const WEEKDAYS: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function todayLondon(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
const at = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);
export function plusDays(iso: string, n: number): string {
  const d = at(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function weekdayOf(iso: string): Weekday | null {
  const i = at(iso).getUTCDay();
  return i >= 1 && i <= 5 ? WEEKDAYS[i - 1] : null;
}
/** "Thu 5 Nov". */
export function shortDate(iso: string): string {
  const d = at(iso);
  return `${DAY_NAMES[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
/** "Thursday 5 November". */
export function longDate(iso: string): string {
  const d = at(iso);
  return `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${LONG_MONTHS[d.getUTCMonth()]}`;
}
/** "Thursdays". */
export function plural(day: string | null | undefined): string {
  return day ? `${day[0].toUpperCase()}${day.slice(1)}s` : "";
}
/** The Monday of a date's week. */
export function mondayOf(iso: string): string {
  const i = at(iso).getUTCDay();
  return plusDays(iso, i === 0 ? -6 : 1 - i);
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export type PaymentStatus = "unpaid" | "pending" | "paid" | "failed" | "waived";

export type DogSession = {
  date: string;
  kind: "full_day" | "full_day_one_off" | "one_to_one";
  placementId: string | null;
  bookingId: string | null;
  cancelled: boolean;
  notes: string | null;
  paymentStatus: PaymentStatus | null;
};

export type Placement = { id: string; day: Weekday; cadence: "weekly" | "alternating"; startOn: string; endOn: string | null };

/** A dog's sessions, cancelled ones flagged (nn_dog_sessions). */
export async function getDogSessions(dogId: string, from: string, to: string): Promise<DogSession[]> {
  const { data, error } = await supabase.rpc("nn_dog_sessions", { p_dog_id: dogId, p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { on_date: string; kind: DogSession["kind"]; placement_id: string | null; booking_id: string | null; cancelled: boolean; notes: string | null; payment_status: PaymentStatus | null }[]).map((r) => ({
    date: String(r.on_date).slice(0, 10),
    kind: r.kind,
    placementId: r.placement_id,
    bookingId: r.booking_id,
    cancelled: !!r.cancelled,
    notes: r.notes,
    paymentStatus: r.payment_status,
  }));
}

/** A dog's regular places still running. */
export async function getPlacements(dogId: string): Promise<Placement[]> {
  const { data, error } = await supabase
    .from("placements")
    .select("id, day, cadence, start_on, end_on")
    .eq("dog_id", dogId)
    .or(`end_on.is.null,end_on.gte.${todayLondon()}`)
    .order("start_on");
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string; day: Weekday; cadence: Placement["cadence"]; start_on: string; end_on: string | null }[]).map((p) => ({
    id: p.id,
    day: p.day,
    cadence: p.cadence,
    startOn: p.start_on,
    endOn: p.end_on,
  }));
}

export function sessionLabel(s: Pick<DogSession, "kind" | "notes">): string {
  if (s.kind === "one_to_one") return s.notes?.match(/morning|afternoon/i) ? `1-1 · ${s.notes}` : "1-1 Training";
  if (s.kind === "full_day_one_off") return s.notes ? `Full Day · ${s.notes}` : "Full Day (one-off)";
  return "Full Day Training";
}

// ---------------------------------------------------------------------------
// How full each day is (6 dogs)
// ---------------------------------------------------------------------------

export const DAY_CAPACITY = 6;
export type DayStatus = "green" | "orange" | "full";
export type Availability = Record<string, { dogs: number; status: DayStatus }>;

export async function getAvailability(from: string, to: string): Promise<Availability> {
  const { data, error } = await supabase.rpc("nn_day_availability", { p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  const out: Availability = {};
  for (const r of (data ?? []) as { on_date: string; dogs: number; status: DayStatus }[]) out[String(r.on_date).slice(0, 10)] = { dogs: r.dogs, status: r.status };
  return out;
}

// ---------------------------------------------------------------------------
// Pushing what a change made
// ---------------------------------------------------------------------------

async function push(result: unknown): Promise<void> {
  const notices = (result as { notices?: unknown } | null)?.notices;
  if (!Array.isArray(notices) || notices.length === 0) return;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch(new URL("/api/sessions/push", config.siteUrl).toString(), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ notices }),
    });
  } catch {
    // The notification rows are saved either way; only the push is missed.
  }
}

// ---------------------------------------------------------------------------
// Owner: cancel (instant, never refunded)
// ---------------------------------------------------------------------------

/** Cancel every session from `from` to `to` (or just `from`). Up to the day before. */
export async function cancelSessions(dogId: string, from: string, to?: string | null, reason?: string): Promise<{ cancelled: number; dates: string[] }> {
  const { data, error } = await supabase.rpc("nn_session_cancel", { p_dog_id: dogId, p_from: from, p_to: to ?? from, p_reason: reason?.trim() || null });
  if (error) throw new Error(error.message);
  void push(data);
  const d = data as { cancelled: number; dates: string[] };
  return { cancelled: d.cancelled, dates: d.dates ?? [] };
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export type RequestKind = "replacement" | "one_off" | "add_regular" | "switch_week" | "switch_permanent";
export type RequestStatus = "pending" | "offered" | "confirmed" | "declined" | "withdrawn";

export type SessionRequest = {
  id: string;
  kind: RequestKind;
  status: RequestStatus;
  accountId: string;
  dogId: string;
  dogName: string;
  dogPhoto: string | null;
  ownerName: string | null;
  placementId: string | null;
  fromDate: string | null;
  service: "full_day" | "one_to_one";
  partOfDay: "morning" | "afternoon" | null;
  cadence: "weekly" | "alternating";
  requestedDate: string | null;
  requestedDay: Weekday | null;
  note: string | null;
  offeredDates: string[];
  confirmedDate: string | null;
  confirmedDay: Weekday | null;
  decisionNote: string | null;
  resultBookingId: string | null;
  createdAt: string;
};

export const isRegularKind = (k: RequestKind) => k === "add_regular" || k === "switch_permanent";

export function requestTitle(r: Pick<SessionRequest, "kind" | "service">): string {
  switch (r.kind) {
    case "replacement":
      return "Replacement day";
    case "one_off":
      return r.service === "one_to_one" ? "1-1 session" : "Extra Full Day";
    case "add_regular":
      return "New regular day";
    case "switch_week":
      return "Move one session";
    default:
      return "Switch regular day";
  }
}

export function requestDetail(r: SessionRequest): string {
  switch (r.kind) {
    case "replacement":
      return `${shortDate(r.requestedDate!)} · for ${shortDate(r.fromDate!)}`;
    case "one_off":
      return `${shortDate(r.requestedDate!)}${r.service === "one_to_one" && r.partOfDay ? ` · ${r.partOfDay}` : ""}`;
    case "add_regular":
      return `${plural(r.requestedDay)}${r.cadence === "alternating" ? ", every other week" : ""}`;
    case "switch_week":
      return `${shortDate(r.fromDate!)} → ${shortDate(r.requestedDate!)}`;
    default:
      return `To ${plural(r.requestedDay)}, for good`;
  }
}

export const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "Waiting for the trainer",
  offered: "Pick a day",
  confirmed: "Confirmed",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

type Row = {
  id: string;
  kind: RequestKind;
  status: RequestStatus;
  account_id: string;
  dog_id: string;
  placement_id: string | null;
  from_date: string | null;
  service: "full_day" | "one_to_one";
  part_of_day: "morning" | "afternoon" | null;
  cadence: "weekly" | "alternating";
  requested_date: string | null;
  requested_day: Weekday | null;
  note: string | null;
  offered_dates: string[] | null;
  confirmed_date: string | null;
  confirmed_day: Weekday | null;
  decision_note: string | null;
  result_booking_id: string | null;
  created_at: string;
  dogs: { name: string; photo_url: string | null } | { name: string; photo_url: string | null }[] | null;
};

const REQUEST_COLUMNS =
  "id, kind, status, account_id, dog_id, placement_id, from_date, service, part_of_day, cadence, requested_date, requested_day, note, offered_dates, confirmed_date, confirmed_day, decision_note, result_booking_id, created_at, dogs(name, photo_url)";

async function ownerNames(ids: string[]): Promise<Record<string, string | null>> {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return {};
  const { data } = await supabase.from("profiles").select("id, owner_name").in("id", list);
  return Object.fromEntries(((data ?? []) as { id: string; owner_name: string | null }[]).map((p) => [p.id, p.owner_name]));
}

/**
 * Requests the signed-in person can see (Row Level Security: an owner's own,
 * or every one for a trainer), newest first. `open`: only pending and offered.
 */
export async function listRequests(opts: { open?: boolean; withOwners?: boolean; id?: string } = {}): Promise<SessionRequest[]> {
  let q = supabase.from("session_requests").select(REQUEST_COLUMNS).order("created_at", { ascending: false }).limit(150);
  if (opts.open) q = q.in("status", ["pending", "offered"]);
  if (opts.id) q = q.eq("id", opts.id);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];
  const owners = opts.withOwners ? await ownerNames(rows.map((r) => r.account_id)) : {};
  return rows.map((r) => {
    const dog = Array.isArray(r.dogs) ? r.dogs[0] : r.dogs;
    return {
      id: r.id,
      kind: r.kind,
      status: r.status,
      accountId: r.account_id,
      dogId: r.dog_id,
      dogName: dog?.name ?? "Dog",
      dogPhoto: dog?.photo_url ?? null,
      ownerName: owners[r.account_id] ?? null,
      placementId: r.placement_id,
      fromDate: r.from_date,
      service: r.service,
      partOfDay: r.part_of_day,
      cadence: r.cadence,
      requestedDate: r.requested_date,
      requestedDay: r.requested_day,
      note: r.note,
      offeredDates: r.offered_dates ?? [],
      confirmedDate: r.confirmed_date,
      confirmedDay: r.confirmed_day,
      decisionNote: r.decision_note,
      resultBookingId: r.result_booking_id,
      createdAt: r.created_at,
    };
  });
}

/** How many requests are waiting for a trainer (pending only: offered ones wait for the owner). */
export async function countPendingRequests(): Promise<number> {
  const { count } = await supabase.from("session_requests").select("id", { count: "exact", head: true }).eq("status", "pending");
  return count ?? 0;
}

export type NewRequest = {
  dogId: string;
  kind: RequestKind;
  date?: string | null;
  day?: Weekday | null;
  service?: "full_day" | "one_to_one";
  partOfDay?: "morning" | "afternoon" | null;
  placementId?: string | null;
  fromDate?: string | null;
  cadence?: "weekly" | "alternating";
  note?: string;
};

export async function createRequest(r: NewRequest): Promise<string> {
  const { data, error } = await supabase.rpc("nn_request_create", {
    p_dog_id: r.dogId,
    p_kind: r.kind,
    p_date: r.date ?? null,
    p_day: r.day ?? null,
    p_service: r.service ?? "full_day",
    p_part_of_day: r.partOfDay ?? null,
    p_placement_id: r.placementId ?? null,
    p_from_date: r.fromDate ?? null,
    p_cadence: r.cadence ?? "weekly",
    p_note: r.note?.trim() || null,
  });
  if (error) throw new Error(error.message);
  void push(data);
  return (data as { id: string }).id;
}

export async function withdrawRequest(id: string): Promise<void> {
  const { data, error } = await supabase.rpc("nn_request_withdraw", { p_id: id });
  if (error) throw new Error(error.message);
  void push(data);
}

/** Owner: take one of the trainer's suggested days. Booked straight away. */
export async function pickOffer(id: string, date: string): Promise<void> {
  const { data, error } = await supabase.rpc("nn_request_pick_offer", { p_id: id, p_date: date });
  if (error) throw new Error(error.message);
  void push(data);
}

/** Trainer: accept, suggest 1–3 dates, or decline. */
export async function decideRequest(id: string, decision: "accept" | "suggest" | "decline", dates: string[] = [], note = ""): Promise<void> {
  const { data, error } = await supabase.rpc("nn_request_decide", {
    p_id: id,
    p_decision: decision,
    p_dates: dates.length ? dates : null,
    p_note: note.trim() || null,
  });
  if (error) throw new Error(error.message);
  void push(data);
}

/** Trainer: move a session (a one-off, or one date of a regular place) to another day. */
export async function moveSession(opts: { dogId: string; from: string; to: string; bookingId?: string | null; placementId?: string | null; note?: string }): Promise<void> {
  const { data, error } = await supabase.rpc("nn_session_move", {
    p_dog_id: opts.dogId,
    p_from: opts.from,
    p_to: opts.to,
    p_booking_id: opts.bookingId ?? null,
    p_placement_id: opts.placementId ?? null,
    p_note: opts.note?.trim() || null,
  });
  if (error) throw new Error(error.message);
  void push(data);
}

// ---------------------------------------------------------------------------
// Trainer: what changed on a day (cancellations, and requests for it)
// ---------------------------------------------------------------------------

export type DayCancellation = { dogName: string; ownerAccountId: string | null; reason: string | null; kind: "regular" | "one_off" };

export async function getDayCancellations(date: string): Promise<DayCancellation[]> {
  const [skips, bookings] = await Promise.all([
    supabase.from("placement_skips").select("reason, placements(account_id, dogs(name))").eq("on_date", date),
    supabase.from("bookings").select("account_id, kind, dogs(name)").eq("on_date", date).not("cancelled_at", "is", null),
  ]);
  type Dog = { name: string } | { name: string }[] | null;
  const name = (d: Dog) => (Array.isArray(d) ? d[0]?.name : d?.name) ?? "A dog";
  const out: DayCancellation[] = [];
  for (const s of (skips.data ?? []) as unknown as { reason: string | null; placements: { account_id: string | null; dogs: Dog } | null }[]) {
    // Moved by a trainer rather than cancelled: it shows on the other day.
    if (s.reason?.startsWith("Moved to")) continue;
    out.push({ dogName: name(s.placements?.dogs ?? null), ownerAccountId: s.placements?.account_id ?? null, reason: s.reason, kind: "regular" });
  }
  for (const b of (bookings.data ?? []) as unknown as { account_id: string | null; dogs: Dog }[]) {
    out.push({ dogName: name(b.dogs), ownerAccountId: b.account_id, reason: null, kind: "one_off" });
  }
  return out;
}

/** Open requests that touch a date (asked for, offered, or the session being moved). */
export function requestsForDate(list: SessionRequest[], date: string): SessionRequest[] {
  return list.filter((r) => r.requestedDate === date || r.fromDate === date || r.offeredDates.includes(date));
}

// ---------------------------------------------------------------------------
// Payments for one-off sessions
// ---------------------------------------------------------------------------

export function defaultSessionPrice(kind: "full_day" | "one_to_one", hasMembership: boolean): number {
  if (kind === "one_to_one") return sessionPrices.oneToOne;
  return hasMembership ? sessionPrices.fullDayMember : sessionPrices.fullDay;
}
export function pounds(pence: number): string {
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
}
/** "£60 (member price)", "£80", "£90". */
export function priceLine(kind: "full_day" | "one_to_one", hasMembership: boolean): string {
  const p = pounds(defaultSessionPrice(kind, hasMembership));
  return kind === "full_day" && hasMembership ? `${p} (member price)` : p;
}

export async function hasMembership(accountId: string): Promise<boolean> {
  const { data } = await supabase.rpc("nn_has_membership", { p_account_id: accountId });
  return data === true;
}

export type UnpaidSession = {
  id: string;
  kind: "full_day" | "one_to_one";
  date: string;
  accountId: string | null;
  dogId: string | null;
  dogName: string | null;
  ownerName: string | null;
  paymentStatus: PaymentStatus;
  amountPence: number | null;
  notes: string | null;
};

/** Trainer: one-offs still to pay (or whose payment failed). */
export async function listUnpaid(): Promise<UnpaidSession[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, kind, on_date, account_id, dog_id, payment_status, amount_pence, notes, dogs(name)")
    .in("payment_status", ["unpaid", "failed"])
    .is("cancelled_at", null)
    .order("on_date")
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as {
    id: string;
    kind: "full_day" | "one_to_one";
    on_date: string;
    account_id: string | null;
    dog_id: string | null;
    payment_status: PaymentStatus;
    amount_pence: number | null;
    notes: string | null;
    dogs: { name: string } | { name: string }[] | null;
  }[];
  const owners = await ownerNames(rows.map((r) => r.account_id ?? ""));
  return rows.map((r) => {
    const dog = Array.isArray(r.dogs) ? r.dogs[0] : r.dogs;
    return {
      id: r.id,
      kind: r.kind,
      date: r.on_date,
      accountId: r.account_id,
      dogId: r.dog_id,
      dogName: dog?.name ?? null,
      ownerName: r.account_id ? owners[r.account_id] ?? null : null,
      paymentStatus: r.payment_status,
      amountPence: r.amount_pence,
      notes: r.notes,
    };
  });
}

export async function countUnpaid(): Promise<number> {
  const { count } = await supabase.from("bookings").select("id", { count: "exact", head: true }).in("payment_status", ["unpaid", "failed"]).is("cancelled_at", null);
  return count ?? 0;
}

/** Trainer: charge by Direct Debit, through the website (it holds the GoCardless key). */
export async function chargeSession(bookingId: string, amountPence: number): Promise<number> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  let res: Response;
  try {
    res = await fetch(new URL("/api/sessions/charge", config.siteUrl).toString(), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, amountPence }),
    });
  } catch {
    throw new Error("Couldn't reach the website. Check your connection and try again.");
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string; amountPence?: number };
  if (!res.ok) throw new Error(body.error || "Couldn't charge that session.");
  return body.amountPence ?? amountPence;
}

export async function setPaymentStatus(bookingId: string, status: "paid" | "waived" | "unpaid"): Promise<void> {
  const { error } = await supabase.from("bookings").update({ payment_status: status }).eq("id", bookingId);
  if (error) throw new Error(error.message);
}
