import { supabase } from "@/lib/supabase";

import { mondayOf, todayLondon } from "./sessions";

/**
 * What the owner's Profile tab shows about each dog, live from Supabase
 * (Row Level Security: their own dogs, cards and homework only).
 */

export type DogDetails = {
  id: string;
  name: string;
  breed: string | null;
  dateOfBirth: string | null;
  photoUrl: string | null;
  registered: boolean;
};

export async function getMyDogDetails(userId: string): Promise<DogDetails[]> {
  const { data, error } = await supabase
    .from("dogs")
    .select("id, name, breed, date_of_birth, photo_url, waiver_signed_at")
    .eq("account_id", userId)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string; name: string; breed: string | null; date_of_birth: string | null; photo_url: string | null; waiver_signed_at: string | null }[]).map((d) => ({
    id: d.id,
    name: d.name,
    breed: d.breed,
    dateOfBirth: d.date_of_birth,
    photoUrl: d.photo_url,
    registered: !!d.waiver_signed_at,
  }));
}

/** "3 years", "7 months", "10 weeks". */
export function ageFrom(dob: string | null): string | null {
  if (!dob) return null;
  const born = new Date(`${dob}T12:00:00Z`);
  const now = new Date();
  let months = (now.getUTCFullYear() - born.getUTCFullYear()) * 12 + (now.getUTCMonth() - born.getUTCMonth());
  if (now.getUTCDate() < born.getUTCDate()) months--;
  if (months < 0) return null;
  if (months >= 24) return `${Math.floor(months / 12)} years`;
  if (months >= 12) return months === 12 ? "1 year" : `1 year ${months - 12} month${months === 13 ? "" : "s"}`;
  if (months >= 3) return `${months} months`;
  const weeks = Math.floor((now.getTime() - born.getTime()) / (7 * 86_400_000));
  return `${weeks} week${weeks === 1 ? "" : "s"}`;
}

/** The trainer's latest words: biggest strength and biggest area to improve (latest card that has each). */
export async function getTrainerHighlights(dogId: string): Promise<{ strength: string | null; toImprove: string | null; date: string | null }> {
  const { data } = await supabase
    .from("report_cards")
    .select("strength, to_improve, session_date")
    .eq("dog_id", dogId)
    .eq("status", "published")
    .order("session_date", { ascending: false, nullsFirst: false })
    .limit(20);
  const rows = (data ?? []) as { strength: string | null; to_improve: string | null; session_date: string | null }[];
  const s = rows.find((r) => r.strength?.trim());
  const t = rows.find((r) => r.to_improve?.trim());
  return { strength: s?.strength?.trim() ?? null, toImprove: t?.to_improve?.trim() ?? null, date: (s ?? t)?.session_date ?? null };
}

/** Days homework was practised: in all, and this week (Monday on). */
export async function getHomeworkDays(dogId: string): Promise<{ total: number; thisWeek: number }> {
  const { data } = await supabase.from("homework_completions").select("practised_on").eq("dog_id", dogId).limit(5000);
  const days = new Set(((data ?? []) as { practised_on: string }[]).map((r) => String(r.practised_on).slice(0, 10)));
  const monday = mondayOf(todayLondon());
  return { total: days.size, thisWeek: [...days].filter((d) => d >= monday).length };
}
