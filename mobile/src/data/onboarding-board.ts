import { postToSite } from "@/lib/site-api";
import { supabase } from "@/lib/supabase";

import { startOnboarding, todayISO, type OnboardingResult, type Weekday } from "./trainer-schedule";

/**
 * Trainer: the Onboarding board, as the website's
 * components/admin/OnboardingBoard.tsx: every contact-form message and meet
 * & greet request (`enquiries`, trainers only), by stage, with where each
 * one is up to (Direct Debit from payment_mandates, their account, their
 * dogs registered). The same writes as the website's lib/records/client.ts
 * updateEnquiry; Start onboarding and the meet & greet email go through the
 * website (GoCardless, email), signed in with the trainer's token.
 * (data/onboarding.ts is the owner's own checklist.)
 */

export type EnquiryStatus = "new" | "meet_greet_booked" | "onboarding" | "closed";

/** The board's stages: closed splits into set up (Done) and closed (not a fit). */
export type Stage = "new" | "meet_greet_booked" | "onboarding" | "set_up" | "closed";

export const STAGES: { value: Stage; label: string }[] = [
  { value: "new", label: "New" },
  { value: "meet_greet_booked", label: "Meet & greet" },
  { value: "onboarding", label: "Onboarding sent" },
  { value: "set_up", label: "Set up" },
  { value: "closed", label: "Closed" },
];

export type Enquiry = {
  id: string;
  kind: "contact" | "booking";
  status: EnquiryStatus;
  name: string;
  email: string;
  phone: string;
  message: string;
  service: string;
  dogNames: string;
  details: Record<string, unknown>;
  meetGreetAt: string | null;
  meetGreetNotes: string;
  accountId: string | null;
  createdAt: string;
  onboardingToken: string | null;
  closedReason: string | null;
  trainingDay: Weekday | null;
  trainingCadence: "weekly" | "alternating" | null;
  firstSessionOn: string | null;
};

export type OnboardingProgress = {
  directDebit: string;
  accountLinked: boolean;
  dogs: { name: string; registered: boolean }[];
};

export const DD_LABEL: Record<string, string> = {
  none: "Not started",
  link_sent: "Link sent, waiting for them",
  pending_submission: "Set up, bank confirming",
  submitted: "Set up, bank confirming",
  active: "Active",
  failed: "Failed",
  cancelled: "Cancelled",
  expired: "Expired",
};
export const DD_DONE = ["pending_submission", "submitted", "active"];

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

/* eslint-disable @typescript-eslint/no-explicit-any */
function toEnquiry(r: any): Enquiry {
  return {
    id: r.id,
    kind: r.kind === "booking" ? "booking" : "contact",
    status: r.status,
    name: str(r.name),
    email: str(r.email),
    phone: str(r.phone),
    message: str(r.message),
    service: str(r.service),
    dogNames: str(r.dog_names),
    details: (r.details as Record<string, unknown>) ?? {},
    meetGreetAt: r.meet_greet_at ?? null,
    meetGreetNotes: str(r.meet_greet_notes),
    accountId: r.account_id ?? null,
    createdAt: r.created_at,
    onboardingToken: r.onboarding_token ?? null,
    closedReason: r.closed_reason ?? null,
    trainingDay: r.training_day ?? null,
    trainingCadence: r.training_cadence ?? null,
    firstSessionOn: r.first_session_on ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function stageOf(e: Pick<Enquiry, "status" | "closedReason">): Stage {
  if (e.status === "closed") return e.closedReason ? "closed" : "set_up";
  return e.status;
}

/** Their postcode's area ("SK9"), from the booking form. */
export function postcodeArea(e: Enquiry): string | null {
  const area = str(e.details.area).trim();
  if (area) return area;
  const pc = str(e.details.postcode).trim().toUpperCase();
  if (!pc) return null;
  return pc.split(/\s+/)[0] || null;
}

/** What they'd like help with: the booking form's choices (saved as the message), plus anything else they wrote. */
export function helpWith(e: Enquiry): string | null {
  if (e.kind !== "booking") return null;
  const other = str(e.details.helpOther).trim();
  return [e.message.trim(), other].filter(Boolean).join(" · ") || null;
}

/** Each dog on the booking form: "Biscuit (Cockapoo, 2 yrs)". */
export function enquiryDogs(e: Enquiry): string[] {
  const dogs = Array.isArray(e.details.dogs) ? (e.details.dogs as { name?: unknown; breed?: unknown; age?: unknown }[]) : [];
  if (dogs.length === 0) return e.dogNames ? e.dogNames.split(/,\s*/) : [];
  return dogs.map((d) => {
    const more = [str(d.breed).trim(), str(d.age).trim()].filter(Boolean).join(", ");
    return `${str(d.name).trim() || "Dog"}${more ? ` (${more})` : ""}`;
  });
}

export async function listEnquiries(): Promise<Enquiry[]> {
  const { data, error } = await supabase.from("enquiries").select("*").order("created_at", { ascending: false }).limit(500);
  if (error) throw new Error("Couldn't load the requests.");
  return (data ?? []).map(toEnquiry);
}

export async function getEnquiry(id: string): Promise<Enquiry | null> {
  const { data, error } = await supabase.from("enquiries").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Couldn't load this request.");
  return data ? toEnquiry(data) : null;
}

/** New requests waiting (for Menu's count). */
export async function countNewEnquiries(): Promise<number> {
  const { count } = await supabase.from("enquiries").select("id", { count: "exact", head: true }).eq("status", "new");
  return count ?? 0;
}

/** Direct Debit, account and dogs, for each request in onboarding. */
export async function getOnboardingProgress(enquiries: Enquiry[]): Promise<Record<string, OnboardingProgress>> {
  if (enquiries.length === 0) return {};
  const ids = enquiries.map((e) => e.id);
  const accounts = enquiries.map((e) => e.accountId).filter((x): x is string => !!x);
  const [mandates, dogs] = await Promise.all([
    supabase
      .from("payment_mandates")
      .select("enquiry_id, account_id, status, created_at")
      .or([`enquiry_id.in.(${ids.join(",")})`, accounts.length ? `account_id.in.(${accounts.join(",")})` : ""].filter(Boolean).join(","))
      .order("created_at", { ascending: false }),
    accounts.length ? supabase.from("dogs").select("account_id, name, waiver_signed_at, sort_order").in("account_id", accounts).order("sort_order") : Promise.resolve({ data: [] }),
  ]);
  const mandateRows = (mandates.data ?? []) as { enquiry_id: string | null; account_id: string | null; status: string }[];
  const dogRows = (dogs.data ?? []) as { account_id: string; name: string; waiver_signed_at: string | null }[];
  const out: Record<string, OnboardingProgress> = {};
  for (const e of enquiries) {
    const m = mandateRows.find((x) => x.enquiry_id === e.id || (e.accountId && x.account_id === e.accountId));
    out[e.id] = {
      directDebit: m?.status ?? "none",
      accountLinked: !!e.accountId,
      dogs: dogRows.filter((d) => d.account_id === e.accountId).map((d) => ({ name: d.name, registered: !!d.waiver_signed_at })),
    };
  }
  return out;
}

async function updateEnquiry(
  id: string,
  patch: {
    status?: EnquiryStatus;
    meetGreetAt?: string | null;
    meetGreetNotes?: string;
    closedReason?: string | null;
    trainingDay?: string | null;
    trainingCadence?: string | null;
    firstSessionOn?: string | null;
  },
): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.trainingDay !== undefined) row.training_day = patch.trainingDay;
  if (patch.trainingCadence !== undefined) row.training_cadence = patch.trainingCadence;
  if (patch.firstSessionOn !== undefined) {
    row.first_session_on = patch.firstSessionOn;
    row.register_reminders_sent = []; // a new date starts the reminders again
  }
  if (patch.status) row.status = patch.status;
  if (patch.closedReason !== undefined) row.closed_reason = patch.closedReason;
  if (patch.meetGreetAt !== undefined) row.meet_greet_at = patch.meetGreetAt;
  if (patch.meetGreetNotes !== undefined) row.meet_greet_notes = patch.meetGreetNotes.trim() || null;
  const { error } = await supabase.from("enquiries").update(row).eq("id", id);
  if (error) throw new Error("Couldn't update the request.");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "3 Nov · 14:05". */
export function cameIn(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "Thursday 12 November, 14:30" — for the email and the alert. */
export function meetGreetLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}

/** Book (or move) the meet & greet; optionally email them the day and time. Returns whether the email went. */
export async function bookMeetGreet(e: Enquiry, iso: string, notes: string, emailThem: boolean): Promise<{ emailed: boolean }> {
  await updateEnquiry(e.id, { status: "meet_greet_booked", meetGreetAt: iso, meetGreetNotes: notes });
  if (!emailThem) return { emailed: false };
  try {
    const res = await postToSite<{ sent?: boolean }>(
      "/api/onboarding/meet-greet",
      { email: e.email, name: e.name, whenLabel: meetGreetLabel(iso), notes: notes.trim() },
      "Couldn't email them.",
    );
    return { emailed: !!res.sent };
  } catch {
    return { emailed: false };
  }
}

export function startEnquiryOnboarding(e: Enquiry): Promise<OnboardingResult> {
  return startOnboarding(e.id);
}

/** Not a fit: closed with a note for yourself. */
export function closeNotAFit(e: Enquiry, reason: string): Promise<void> {
  return updateEnquiry(e.id, { status: "closed", closedReason: reason.trim() || "Not a fit" });
}

/** Onboarding finished: they're set up. */
export function markSetUp(e: Enquiry): Promise<void> {
  return updateEnquiry(e.id, { status: "closed", closedReason: null });
}

export function reopen(e: Enquiry): Promise<void> {
  return updateEnquiry(e.id, { status: "new", closedReason: null });
}

const DAYS: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];

/**
 * Set their regular Full Day Training day: the website's TrainingDayForm
 * (training_day, training_cadence, first_session_on on the request, which
 * restarts the register reminders), plus the regular place on the
 * calendar it stands for: the request's held place moves to the new day,
 * or one is held from the first session (filled in with their dog once
 * they register, as Send onboarding on a day does).
 */
export async function setTrainingDay(e: Enquiry, day: Weekday, cadence: "weekly" | "alternating", firstOn: string): Promise<void> {
  const weekday = DAYS[(new Date(`${firstOn}T12:00:00Z`).getUTCDay() + 6) % 7];
  if (weekday !== day) throw new Error(`The first session should be on a ${day[0].toUpperCase()}${day.slice(1)}.`);
  await updateEnquiry(e.id, { trainingDay: day, trainingCadence: cadence, firstSessionOn: firstOn });
  const { data: places } = await supabase
    .from("placements")
    .select("id")
    .eq("enquiry_id", e.id)
    .or(`end_on.is.null,end_on.gte.${todayISO()}`)
    .order("created_at", { ascending: false })
    .limit(1);
  const existing = ((places ?? []) as { id: string }[])[0];
  if (existing) {
    const { error } = await supabase.from("placements").update({ day, cadence, start_on: firstOn, end_on: null }).eq("id", existing.id);
    if (error) throw new Error("Saved their training day, but couldn't move their place on the calendar.");
    return;
  }
  const { data: auth } = await supabase.auth.getSession();
  const { error } = await supabase.from("placements").insert({
    day,
    cadence,
    start_on: firstOn,
    enquiry_id: e.id,
    account_id: e.accountId,
    holder_name: [e.name, e.dogNames].filter(Boolean).join(" — "),
    created_by: auth.session?.user.id ?? null,
  });
  if (error) throw new Error("Saved their training day, but couldn't hold their place on the calendar.");
}

/** The join link, once onboarding has started (for Share). */
export function joinUrl(e: Enquiry, siteUrl: string): string | null {
  return e.onboardingToken ? new URL(`/join/${e.onboardingToken}`, siteUrl).toString() : null;
}
