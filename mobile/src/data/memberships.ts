import { onlineWeeklyPence, sessionPrices } from "@/lib/config";
import { supabase } from "@/lib/supabase";

import { uploadVideo, VIDEO_BUCKET, type PickedVideo } from "./homework/assigned";
import { pushNotices } from "./register";
import { plural, pounds, shortDate, slotLabel, type SlotTime, type Weekday } from "./sessions";
import { addRegularPlace, notifyBooked } from "./trainer-schedule";

/**
 * Memberships, for all three services, and Online Training's week. A
 * membership is a `placements` row with a service (the website's
 * supabase/migrations/20261120000000_memberships_online.sql):
 *   full_day    a regular weekday, every week or every other week (£60 a day);
 *   one_to_one  a weekday and a slot (12–1pm or 1–2pm), every week or every
 *               other week, at £90 (its sessions are 1-1 bookings);
 *   online      no day or time: weekly homework from a trainer, £25 a week.
 * Any membership makes 1-1s £90; only a Full Day membership makes Full Days £60.
 * Online's week: the trainer sends homework from the Online board (an
 * 'online_week' report card, shown in Homework), and the owner can check in
 * on Sunday evenings (optional, under a minute).
 */

export type MembershipService = "full_day" | "one_to_one" | "online";

export type Membership = {
  id: string;
  service: MembershipService;
  day: Weekday | null;
  cadence: "weekly" | "alternating";
  startOn: string;
  endOn: string | null;
  /** "12:00" for a 1-1 membership. */
  startTime: string | null;
  durationMin: number | null;
  goals: string[];
  dogId: string | null;
  dogName: string | null;
};

export const SERVICE_LABEL: Record<MembershipService, string> = {
  full_day: "Full Day Training",
  one_to_one: "1-1 Training",
  online: "Online Training",
};

/** "£60 a day", "£90 a session", "£25 a week". */
export function membershipPrice(service: MembershipService): string {
  if (service === "online") return `${pounds(onlineWeeklyPence)} a week`;
  if (service === "one_to_one") return `${pounds(sessionPrices.oneToOneMember)} a session`;
  return `${pounds(sessionPrices.fullDayMember)} a day`;
}

/** "Tuesdays, every week", "Thursdays 12–1pm, every other week", "Homework every week". */
export function membershipSchedule(m: Pick<Membership, "service" | "day" | "cadence" | "startTime">): string {
  if (m.service === "online") return "Homework every week";
  const often = m.cadence === "alternating" ? "every other week" : "every week";
  return m.service === "one_to_one" ? `${plural(m.day)} ${slotLabel(m.startTime)}, ${often}` : `${plural(m.day)}, ${often}`;
}

type PlacementRow = {
  id: string;
  service?: MembershipService | null;
  day: Weekday | null;
  cadence: "weekly" | "alternating";
  start_on: string;
  end_on: string | null;
  start_time?: string | null;
  duration_min?: number | null;
  goals?: string[] | null;
  dog_id: string | null;
  dogs?: { name: string } | { name: string }[] | null;
};

function toMembership(r: PlacementRow): Membership {
  const dog = Array.isArray(r.dogs) ? r.dogs[0] : r.dogs;
  return {
    id: r.id,
    service: r.service ?? "full_day",
    day: r.day,
    cadence: r.cadence,
    startOn: r.start_on,
    endOn: r.end_on,
    startTime: r.start_time ? String(r.start_time).slice(0, 5) : null,
    durationMin: r.duration_min ?? null,
    goals: r.goals ?? [],
    dogId: r.dog_id,
    dogName: dog?.name ?? null,
  };
}

// ---------------------------------------------------------------------------
// The owner
// ---------------------------------------------------------------------------

export type MyMemberships = {
  memberships: Membership[];
  /** Sessions booked from today on (one-offs, 1-1s). */
  upcomingBookings: number;
  /** 1-1s at the member price. */
  member: boolean;
  /** Full Days at the member price. */
  fullDayMember: boolean;
};

/** The signed-in owner's memberships. Null if it can't tell (before the database update, or offline). */
export async function getMyMemberships(): Promise<MyMemberships | null> {
  const { data, error } = await supabase.rpc("nn_my_memberships");
  if (error || !data) return null;
  const d = data as { memberships?: (Omit<Membership, "startTime"> & { startTime: string | null })[]; upcomingBookings?: number; member?: boolean; fullDayMember?: boolean };
  return {
    memberships: (d.memberships ?? []).map((m) => ({ ...m, goals: m.goals ?? [] })),
    upcomingBookings: Number(d.upcomingBookings ?? 0),
    member: !!d.member,
    fullDayMember: !!d.fullDayMember,
  };
}

/** Online Training and nothing on the calendar: no Full Day or 1-1 membership and no sessions booked. */
export function isOnlineOnly(m: MyMemberships | null): boolean {
  if (!m) return false;
  return m.memberships.some((x) => x.service === "online") && !m.memberships.some((x) => x.service !== "online") && m.upcomingBookings === 0;
}

export function hasOnline(m: MyMemberships | null): boolean {
  return !!m?.memberships.some((x) => x.service === "online");
}

/** Online members' chat promise. */
export const REPLY_PROMISE = "Message us any time — we reply within 12 hours.";

// ---------------------------------------------------------------------------
// The trainer: starting and ending
// ---------------------------------------------------------------------------

/** A dog's memberships still running (or starting). */
export async function getDogMemberships(dogId: string): Promise<Membership[]> {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  const res = await supabase
    .from("placements")
    .select("id, service, day, cadence, start_on, end_on, start_time, duration_min, goals, dog_id")
    .eq("dog_id", dogId)
    .or(`end_on.is.null,end_on.gte.${today}`)
    .order("start_on");
  if (!res.error) return ((res.data ?? []) as PlacementRow[]).map(toMembership);
  if (!/service|start_time|goals/.test(res.error.message)) throw new Error(res.error.message);
  // Before the database update: every place is a Full Day.
  const old = await supabase.from("placements").select("id, day, cadence, start_on, end_on, dog_id").eq("dog_id", dogId).or(`end_on.is.null,end_on.gte.${today}`).order("start_on");
  if (old.error) throw new Error(old.error.message);
  return ((old.data ?? []) as PlacementRow[]).map(toMembership);
}

export type StartOneToOne = {
  dogId: string;
  day: Weekday;
  cadence: "weekly" | "alternating";
  time: SlotTime;
  /** The first session, or the day to start looking from. */
  startOn: string;
  /** The 1-1 it grew from: its price becomes £90, or the difference is owed back. */
  bookingId?: string | null;
  durationMin?: number | null;
};

/** "Start 1-1 membership". The owner's told; any refund owed shows on Requests as a to-do. */
export async function startOneToOneMembership(s: StartOneToOne): Promise<{ placementId: string; firstOn: string; refundPence: number; ownerName: string }> {
  const { data, error } = await supabase.rpc("nn_membership_start_one_to_one", {
    p_dog_id: s.dogId,
    p_day: s.day,
    p_cadence: s.cadence,
    p_time: s.time,
    p_start_on: s.startOn,
    p_booking_id: s.bookingId ?? null,
    p_duration_min: s.durationMin ?? 60,
  });
  if (error) throw new Error(error.message);
  const d = data as { placementId: string; firstOn: string; refundPence: number; ownerName: string; notices?: unknown };
  void pushNotices(d.notices);
  return { placementId: d.placementId, firstOn: d.firstOn, refundPence: Number(d.refundPence ?? 0), ownerName: d.ownerName };
}

/** Put a dog on Online Training, with their goals. The owner's told. */
export async function startOnlineMembership(dogId: string, goals: string[], startOn?: string): Promise<string> {
  const { data, error } = await supabase.rpc("nn_membership_start_online", {
    p_dog_id: dogId,
    p_start_on: startOn ?? null,
    p_goals: goals.map((g) => g.trim()).filter(Boolean),
  });
  if (error) throw new Error(error.message);
  const d = data as { placementId: string; notices?: unknown };
  void pushNotices(d.notices);
  return d.placementId;
}

/** A Full Day membership: the regular place, as a day's "Add a regular place" makes it, and the owner's told. */
export async function startFullDayMembership(opts: { dogId: string; accountId: string; startOn: string; cadence: "weekly" | "alternating" }): Promise<string> {
  const id = await addRegularPlace(opts.startOn, opts.cadence, { accountId: opts.accountId, dogId: opts.dogId });
  await notifyBooked("full_day", id);
  return id;
}

/** End a membership after `lastDate`. A 1-1 membership's later sessions go (unless charged). */
export async function endMembership(placementId: string, lastDate: string): Promise<void> {
  const { error } = await supabase.rpc("nn_membership_end", { p_placement_id: placementId, p_last: lastDate });
  if (error) throw new Error(error.message);
}

/** An online member's goals (a simple list). */
export async function saveGoals(placementId: string, goals: string[]): Promise<void> {
  const clean = goals.map((g) => g.trim()).filter(Boolean).slice(0, 20);
  const { error } = await supabase.from("placements").update({ goals: clean }).eq("id", placementId);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// The trainer's Online board
// ---------------------------------------------------------------------------

export type DrillRating = "great" | "ok" | "struggled";
export type WeekOverall = "great" | "ok" | "tough";
export const DRILL_RATINGS: { value: DrillRating; label: string }[] = [
  { value: "great", label: "Great" },
  { value: "ok", label: "OK" },
  { value: "struggled", label: "Struggled" },
];
export const OVERALL: { value: WeekOverall; label: string }[] = [
  { value: "great", label: "Great week" },
  { value: "ok", label: "OK" },
  { value: "tough", label: "Tough week" },
];
export const OVERALL_LABEL: Record<WeekOverall, string> = { great: "A great week", ok: "An OK week", tough: "A tough week" };

export type Checkin = {
  id: string;
  weekOf: string;
  overall: WeekOverall | null;
  note: string | null;
  drills: { name: string; rating: DrillRating }[];
  video: boolean;
  createdAt: string;
};

export type OnlineMember = {
  placementId: string;
  dogId: string | null;
  dogName: string;
  dogPhoto: string | null;
  accountId: string | null;
  ownerName: string | null;
  goals: string[];
  startOn: string;
  lastCheckin: Checkin | null;
  checkedInThisWeek: boolean;
  /** This week's homework, once it's sent. */
  thisWeekCardId: string | null;
  lastCardId: string | null;
};

export type OnlineBoard = { checkinWeek: string; homeworkWeek: string; members: OnlineMember[] };

export async function getOnlineBoard(): Promise<OnlineBoard> {
  const { data, error } = await supabase.rpc("nn_online_board");
  if (error) throw new Error(error.message);
  const d = data as { checkinWeek: string; homeworkWeek: string; members: (OnlineMember & { goals: string[] | null })[] };
  return {
    checkinWeek: d.checkinWeek,
    homeworkWeek: d.homeworkWeek,
    members: (d.members ?? []).map((m) => ({ ...m, goals: m.goals ?? [], lastCheckin: m.lastCheckin ?? null })),
  };
}

/** "3 of 7 still need this week's homework". */
export function boardHeadline(b: OnlineBoard): string {
  const left = b.members.filter((m) => !m.thisWeekCardId).length;
  if (b.members.length === 0) return "No online members yet";
  if (left === 0) return `All ${b.members.length} have this week's homework`;
  return `${left} of ${b.members.length} still need this week's homework`;
}

/** "Week of 23 Nov". */
export function weekLabel(monday: string): string {
  return `Week of ${shortDate(monday).replace(/^\w+ /, "")}`;
}

export type WeekDrill = { category: string; name: string; ref?: string | null; pillar?: string | null; note?: string | null };

/** Send this week's homework (published straight away) and tell the owner. Returns the card's id. */
export async function sendWeekHomework(opts: { dogId: string; drills: WeekDrill[]; notes: string; review: string }): Promise<string> {
  const { data, error } = await supabase.rpc("nn_online_send_week", {
    p_dog_id: opts.dogId,
    p_items: opts.drills.map((d) => ({ category: d.category, name: d.name, ref: d.ref ?? null, pillar: d.pillar ?? null, note: d.note ?? null })),
    p_notes: opts.notes.trim() || null,
    p_review: opts.review.trim() || null,
  });
  if (error) throw new Error(error.message);
  const d = data as { cardId: string; notices?: unknown };
  void pushNotices(d.notices);
  return d.cardId;
}

// ---------------------------------------------------------------------------
// The owner's weekly check-in
// ---------------------------------------------------------------------------

export type CheckinForm = {
  dogId: string;
  dogName: string;
  weekOf: string;
  /** This week's homework drills, to tap how each went. */
  drills: { itemId: string; name: string; category: string | null }[];
  done: Checkin | null;
};

/** One form per dog on Online Training. */
export async function getCheckinForms(): Promise<CheckinForm[]> {
  const mine = await getMyMemberships();
  const dogs = (mine?.memberships ?? []).filter((m) => m.service === "online" && m.dogId);
  if (dogs.length === 0) return [];
  const { data: week } = await supabase.rpc("nn_checkin_week");
  const weekOf = typeof week === "string" ? week.slice(0, 10) : "";
  const ids = dogs.map((d) => d.dogId!) as string[];
  const [cards, done] = await Promise.all([
    supabase
      .from("report_cards")
      .select("id, dog_id, week_of, report_card_items(id, drill_name, category, sort_order)")
      .in("dog_id", ids)
      .eq("kind", "online_week")
      .eq("status", "published")
      .order("week_of", { ascending: false })
      .limit(20),
    supabase.from("online_checkins").select("id, dog_id, week_of, overall, note, drills, video_path, created_at").in("dog_id", ids).eq("week_of", weekOf),
  ]);
  type CardRow = { id: string; dog_id: string; week_of: string | null; report_card_items: { id: string; drill_name: string; category: string | null; sort_order: number }[] | null };
  type DoneRow = { id: string; dog_id: string; week_of: string; overall: WeekOverall | null; note: string | null; drills: { name: string; rating: DrillRating }[] | null; video_path: string | null; created_at: string };
  return dogs.map((m) => {
    // This week's homework, else the latest (it hasn't been sent yet).
    const card = ((cards.data ?? []) as CardRow[]).find((c) => c.dog_id === m.dogId && (!c.week_of || c.week_of <= weekOf));
    const d = ((done.data ?? []) as DoneRow[]).find((x) => x.dog_id === m.dogId);
    return {
      dogId: m.dogId!,
      dogName: m.dogName ?? "Your dog",
      weekOf,
      drills: [...(card?.report_card_items ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((i) => ({ itemId: i.id, name: i.drill_name, category: i.category })),
      done: d ? { id: d.id, weekOf: d.week_of, overall: d.overall, note: d.note, drills: d.drills ?? [], video: !!d.video_path, createdAt: d.created_at } : null,
    };
  });
}

/** Send the check-in: shown to the trainers as a chat card and on their Online board. */
export async function submitCheckin(opts: {
  dogId: string;
  ratings: Record<string, DrillRating>;
  overall: WeekOverall | null;
  note: string;
  video: PickedVideo | null;
  onStage?: (stage: "uploading" | "saving") => void;
}): Promise<void> {
  let videoPath: string | null = null;
  if (opts.video) {
    opts.onStage?.("uploading");
    videoPath = await uploadVideo("checkins", opts.video);
  }
  opts.onStage?.("saving");
  const { data, error } = await supabase.rpc("nn_online_checkin_submit", {
    p_dog_id: opts.dogId,
    p_drills: Object.entries(opts.ratings).map(([itemId, rating]) => ({ item_id: itemId, rating })),
    p_overall: opts.overall,
    p_note: opts.note.trim() || null,
    p_video_path: videoPath,
    p_video_name: opts.video?.name ?? null,
  });
  if (error) {
    if (videoPath) void supabase.storage.from(VIDEO_BUCKET).remove([videoPath]);
    throw new Error(error.message || "Couldn't send your check-in. Please try again.");
  }
  void pushNotices((data as { notices?: unknown } | null)?.notices);
}
