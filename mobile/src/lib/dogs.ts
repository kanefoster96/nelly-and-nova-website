/**
 * Per-dog data for the profile card — real Supabase tables throughout:
 * `dogs`, `skills` + `dog_skills` (level), `training_sessions` +
 * `session_notices` (next/today's session and any reminder attached to it,
 * e.g. a trainer-added weather notice — "bring a coat").
 */
import { supabase } from "@/lib/supabase";
import { accountLevel } from "@/config/skills";

export type DogDetail = {
  breed: string;
  age: string;
};

export type SessionNotice = {
  id: string;
  kind: "info" | "heat" | "weather" | "cancellation";
  message: string;
};

export type NextSession = {
  id: string;
  scheduledAt: string;
  isToday: boolean;
  kind: string;
  location: string;
  notices: SessionNotice[];
};

/** "2 yrs", "8 months" — from a date_of_birth (yyyy-mm-dd). */
function formatAge(dob: string): string {
  const birth = new Date(dob);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 24) return `${Math.max(months, 0)} month${months === 1 ? "" : "s"}`;
  const years = Math.floor(months / 12);
  return `${years} yrs`;
}

export async function getDogDetail(dogId: string): Promise<DogDetail> {
  const { data } = await supabase.from("dogs").select("breed, date_of_birth").eq("id", dogId).single();
  return {
    breed: data?.breed ?? "",
    age: data?.date_of_birth ? formatAge(data.date_of_birth) : "",
  };
}

/** Overall level (1-…), from the fixed skill pillars + this dog's learnt set. */
export async function getDogLevel(dogId: string): Promise<number> {
  const { data } = await supabase.from("dog_skills").select("skill_id").eq("dog_id", dogId);
  const learnt = new Set((data ?? []).map((d) => d.skill_id as string));
  return accountLevel(learnt);
}

/** Completed training sessions for this dog — a simple, real "experience" stat. */
export async function getCompletedSessionCount(dogId: string): Promise<number> {
  const { count } = await supabase
    .from("training_sessions")
    .select("id", { count: "exact", head: true })
    .eq("dog_id", dogId)
    .eq("status", "completed");
  return count ?? 0;
}

const KIND_LABEL: Record<string, string> = {
  "one-to-one": "1-1 Training",
  "walk-and-train": "Walk & Train",
  group: "Group session",
  assessment: "Assessment",
  other: "Session",
};

export function sessionKindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? "Session";
}

export type UpcomingSession = {
  id: string;
  scheduledAt: string;
  kind: string;
  location: string;
};

/** All future scheduled sessions for this dog, soonest first — for the Calendar tab. */
export async function getUpcomingSessions(dogId: string): Promise<UpcomingSession[]> {
  const now = new Date();

  const { data } = await supabase
    .from("training_sessions")
    .select("id, scheduled_at, kind, location")
    .eq("dog_id", dogId)
    .eq("status", "scheduled")
    .gte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: true });

  return (data ?? []).map((s) => ({
    id: s.id,
    scheduledAt: s.scheduled_at,
    kind: s.kind,
    location: s.location ?? "",
  }));
}

/** The next scheduled session for this dog (today's, if it's today), with any notices attached. */
export async function getNextSession(dogId: string): Promise<NextSession | null> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const { data: session } = await supabase
    .from("training_sessions")
    .select("id, scheduled_at, kind, location")
    .eq("dog_id", dogId)
    .eq("status", "scheduled")
    .gte("scheduled_at", startOfToday.toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!session) return null;

  const { data: notices } = await supabase
    .from("session_notices")
    .select("id, kind, message")
    .eq("session_id", session.id)
    .order("created_at", { ascending: false });

  const scheduled = new Date(session.scheduled_at);
  const now = new Date();

  return {
    id: session.id,
    scheduledAt: session.scheduled_at,
    isToday:
      scheduled.getFullYear() === now.getFullYear() &&
      scheduled.getMonth() === now.getMonth() &&
      scheduled.getDate() === now.getDate(),
    kind: session.kind,
    location: session.location ?? "",
    notices: (notices ?? []) as SessionNotice[],
  };
}
