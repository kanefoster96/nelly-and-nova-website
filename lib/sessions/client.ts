"use client";

/**
 * Session requests, cancellations and session payments, for the website's
 * trainer pages (components/inbox/RescheduleRequests.tsx). The database does
 * the work in SECURITY DEFINER functions (supabase/migrations/
 * 20261104050000_dog_profile.sql) and hands back the notifications it made;
 * app/api/sessions/push sends them to phones. The app has the same in
 * mobile/src/data/sessions.ts.
 */
import { createClient } from "@/lib/supabase/client";
import { formatPence } from "./prices";

export type RequestKind = "replacement" | "one_off" | "add_regular" | "switch_week" | "switch_permanent";
export type RequestStatus = "pending" | "offered" | "confirmed" | "declined" | "withdrawn";
export type PaymentStatus = "unpaid" | "pending" | "paid" | "failed" | "waived";

export type SessionRequest = {
  id: string;
  kind: RequestKind;
  status: RequestStatus;
  accountId: string;
  dogId: string;
  dogName: string;
  ownerName: string | null;
  placementId: string | null;
  fromDate: string | null;
  service: "full_day" | "one_to_one";
  partOfDay: "morning" | "afternoon" | null;
  cadence: "weekly" | "alternating";
  requestedDate: string | null;
  requestedDay: string | null;
  note: string | null;
  offeredDates: string[];
  confirmedDate: string | null;
  confirmedDay: string | null;
  decisionNote: string | null;
  resultBookingId: string | null;
  createdAt: string;
};

export type UnpaidSession = {
  id: string;
  kind: "full_day" | "one_to_one";
  date: string;
  accountId: string | null;
  dogName: string | null;
  ownerName: string | null;
  paymentStatus: PaymentStatus;
  amountPence: number | null;
  notes: string | null;
};

const sb = () => createClient();

function day(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
}
const plural = (d: string | null) => (d ? `${d[0].toUpperCase()}${d.slice(1)}s` : "");

/** "Replacement day · Mon 9 Nov (for Thu 5 Nov)". */
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
      return `${day(r.requestedDate!)} · for ${day(r.fromDate!)}, cancelled`;
    case "one_off":
      return `${day(r.requestedDate!)}${r.service === "one_to_one" && r.partOfDay ? ` · ${r.partOfDay}` : ""}`;
    case "add_regular":
      return `${plural(r.requestedDay)}${r.cadence === "alternating" ? ", every other week" : ""}`;
    case "switch_week":
      return `${day(r.fromDate!)} → ${day(r.requestedDate!)}`;
    default:
      return `To ${plural(r.requestedDay)}, for good`;
  }
}

export const isRegularKind = (k: RequestKind) => k === "add_regular" || k === "switch_permanent";
export const shortDay = day;

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
  requested_day: string | null;
  note: string | null;
  offered_dates: string[] | null;
  confirmed_date: string | null;
  confirmed_day: string | null;
  decision_note: string | null;
  result_booking_id: string | null;
  created_at: string;
  dogs: { name: string } | { name: string }[] | null;
};

async function ownerNames(ids: (string | null)[]): Promise<Record<string, string | null>> {
  const list = [...new Set(ids.filter((x): x is string => !!x))];
  if (!list.length) return {};
  const { data } = await sb().from("profiles").select("id, owner_name").in("id", list);
  return Object.fromEntries((data ?? []).map((p) => [p.id as string, (p.owner_name as string | null) ?? null]));
}

/** Open requests (pending and offered), then the latest decided ones. */
export async function listRequests(): Promise<SessionRequest[]> {
  const { data, error } = await sb()
    .from("session_requests")
    .select(
      "id, kind, status, account_id, dog_id, placement_id, from_date, service, part_of_day, cadence, requested_date, requested_day, note, offered_dates, confirmed_date, confirmed_day, decision_note, result_booking_id, created_at, dogs(name)"
    )
    .order("created_at", { ascending: false })
    .limit(150);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];
  const owners = await ownerNames(rows.map((r) => r.account_id));
  return rows.map((r) => {
    const dog = Array.isArray(r.dogs) ? r.dogs[0] : r.dogs;
    return {
      id: r.id,
      kind: r.kind,
      status: r.status,
      accountId: r.account_id,
      dogId: r.dog_id,
      dogName: dog?.name ?? "Dog",
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

/** Push the notifications a change made (best effort). */
async function push(result: unknown): Promise<void> {
  const notices = (result as { notices?: unknown } | null)?.notices;
  if (!Array.isArray(notices) || notices.length === 0) return;
  try {
    await fetch("/api/sessions/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notices }) });
  } catch {
    // The notification rows are there either way.
  }
}

export async function decideRequest(id: string, decision: "accept" | "suggest" | "decline", dates: string[] = [], note = ""): Promise<void> {
  const { data, error } = await sb().rpc("nn_request_decide", { p_id: id, p_decision: decision, p_dates: dates.length ? dates : null, p_note: note || null });
  if (error) throw new Error(error.message);
  await push(data);
}

/** Move a confirmed one-off (or a regular date) to another day. */
export async function moveSession(opts: { dogId: string; from: string; to: string; bookingId?: string | null; placementId?: string | null; note?: string }): Promise<void> {
  const { data, error } = await sb().rpc("nn_session_move", {
    p_dog_id: opts.dogId,
    p_from: opts.from,
    p_to: opts.to,
    p_booking_id: opts.bookingId ?? null,
    p_placement_id: opts.placementId ?? null,
    p_note: opts.note || null,
  });
  if (error) throw new Error(error.message);
  await push(data);
}

/** Dogs booked for Full Day Training per date ("5" of 6). */
export async function dayCounts(from: string, to: string): Promise<Record<string, number>> {
  const { data, error } = await sb().rpc("nn_day_availability", { p_from: from, p_to: to });
  if (error) return {};
  return Object.fromEntries(((data ?? []) as { on_date: string; dogs: number }[]).map((r) => [String(r.on_date).slice(0, 10), r.dogs]));
}

export const DAY_CAPACITY = 6;

// --- Session payments ---------------------------------------------------------

/** One-offs, replacements, extra days and 1-1s still to be paid (or failed). */
export async function listUnpaid(): Promise<UnpaidSession[]> {
  const { data, error } = await sb()
    .from("bookings")
    .select("id, kind, on_date, account_id, payment_status, amount_pence, notes, dogs(name)")
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
    payment_status: PaymentStatus;
    amount_pence: number | null;
    notes: string | null;
    dogs: { name: string } | { name: string }[] | null;
  }[];
  const owners = await ownerNames(rows.map((r) => r.account_id));
  return rows.map((r) => {
    const dog = Array.isArray(r.dogs) ? r.dogs[0] : r.dogs;
    return {
      id: r.id,
      kind: r.kind,
      date: r.on_date,
      accountId: r.account_id,
      dogName: dog?.name ?? null,
      ownerName: r.account_id ? owners[r.account_id] ?? null : null,
      paymentStatus: r.payment_status,
      amountPence: r.amount_pence,
      notes: r.notes,
    };
  });
}

export async function hasMembership(accountId: string): Promise<boolean> {
  const { data } = await sb().rpc("nn_has_membership", { p_account_id: accountId });
  return data === true;
}

/** Charge by Direct Debit (the trainer tapped Charge). */
export async function chargeSession(bookingId: string, amountPence: number): Promise<string> {
  const res = await fetch("/api/sessions/charge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId, amountPence }),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; amountPence?: number };
  if (!res.ok) throw new Error(body.error || "Couldn't charge that session.");
  return `Charged ${formatPence(body.amountPence ?? amountPence)}. It'll show as paid once GoCardless confirms it.`;
}

export async function setPaymentStatus(bookingId: string, status: "paid" | "waived" | "unpaid"): Promise<void> {
  const { error } = await sb().from("bookings").update({ payment_status: status }).eq("id", bookingId);
  if (error) throw new Error(error.message);
}
