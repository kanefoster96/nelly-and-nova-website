/**
 * Coach-side schedule — real `training_sessions` (+ `session_notices`,
 * `dogs`, `profiles`), grouped for the Dashboard and Calendar tabs, plus the
 * reschedule actions the Calendar's day view offers per dog.
 */
import { supabase } from "@/lib/supabase";

export type ScheduleSession = {
  id: string;
  dogId: string;
  dogName: string;
  ownerName: string;
  scheduledAt: string;
  kind: string;
  location: string;
  status: string;
  notices: { id: string; kind: string; message: string }[];
};

type SessionRow = {
  id: string;
  dog_id: string;
  scheduled_at: string;
  kind: string;
  location: string | null;
  status: string;
  dogs: { name: string; profiles: { owner_name: string | null } | { owner_name: string | null }[] | null } | { name: string; profiles: { owner_name: string | null } | { owner_name: string | null }[] | null }[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function mapRow(row: SessionRow, noticesBySession: Map<string, ScheduleSession["notices"]>): ScheduleSession {
  const dog = one(row.dogs);
  return {
    id: row.id,
    dogId: row.dog_id,
    dogName: dog?.name || "Dog",
    ownerName: one(dog?.profiles ?? null)?.owner_name || "Member",
    scheduledAt: row.scheduled_at,
    kind: row.kind,
    location: row.location ?? "",
    status: row.status,
    notices: noticesBySession.get(row.id) ?? [],
  };
}

async function withNotices(rows: SessionRow[]): Promise<ScheduleSession[]> {
  const ids = rows.map((r) => r.id);
  const noticesBySession = new Map<string, ScheduleSession["notices"]>();
  if (ids.length > 0) {
    const { data: notices } = await supabase
      .from("session_notices")
      .select("id, session_id, kind, message")
      .in("session_id", ids);
    for (const n of notices ?? []) {
      const list = noticesBySession.get(n.session_id) ?? [];
      list.push({ id: n.id, kind: n.kind, message: n.message });
      noticesBySession.set(n.session_id, list);
    }
  }
  return rows.map((r) => mapRow(r, noticesBySession));
}

const SELECT = "id, dog_id, scheduled_at, kind, location, status, dogs(name, profiles(owner_name))";

export async function getSessionsForToday(): Promise<ScheduleSession[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const { data } = await supabase
    .from("training_sessions")
    .select(SELECT)
    .gte("scheduled_at", start.toISOString())
    .lt("scheduled_at", end.toISOString())
    .order("scheduled_at", { ascending: true });

  return withNotices((data ?? []) as SessionRow[]);
}

/** Every session in [startISO, endISO) — for the calendar month grid. */
export async function getSessionsInRange(startISO: string, endISO: string): Promise<ScheduleSession[]> {
  const { data } = await supabase
    .from("training_sessions")
    .select(SELECT)
    .gte("scheduled_at", startISO)
    .lt("scheduled_at", endISO)
    .order("scheduled_at", { ascending: true });

  return withNotices((data ?? []) as SessionRow[]);
}

export async function rescheduleOneOff(sessionId: string, newScheduledAt: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("training_sessions")
    .update({ scheduled_at: newScheduledAt })
    .eq("id", sessionId);
  return { error: error?.message ?? null };
}

/**
 * Moves every future 'scheduled' session for this dog that falls on the same
 * weekday as `referenceScheduledAt` to `newWeekday`/`newHour`:`newMinute`
 * (device-local time) — the real schema has no recurring-slot row, just
 * individual dated sessions, so "permanent" means "this and every future
 * occurrence", bulk-updated in place.
 */
export async function reschedulePermanent(input: {
  dogId: string;
  referenceScheduledAt: string;
  newWeekday: number;
  newHour: number;
  newMinute: number;
}): Promise<{ movedCount: number; error: string | null }> {
  const ref = new Date(input.referenceScheduledAt);
  const oldWeekday = ref.getDay();

  const { data, error } = await supabase
    .from("training_sessions")
    .select("id, scheduled_at")
    .eq("dog_id", input.dogId)
    .eq("status", "scheduled")
    .gte("scheduled_at", new Date().toISOString());
  if (error) return { movedCount: 0, error: error.message };

  const dayDelta = (input.newWeekday - oldWeekday + 7) % 7;
  const matching = (data ?? []).filter((s) => new Date(s.scheduled_at).getDay() === oldWeekday);

  for (const s of matching) {
    const d = new Date(s.scheduled_at);
    d.setDate(d.getDate() + dayDelta);
    d.setHours(input.newHour, input.newMinute, 0, 0);
    const { error: updateError } = await supabase
      .from("training_sessions")
      .update({ scheduled_at: d.toISOString() })
      .eq("id", s.id);
    if (updateError) return { movedCount: 0, error: updateError.message };
  }

  return { movedCount: matching.length, error: null };
}
