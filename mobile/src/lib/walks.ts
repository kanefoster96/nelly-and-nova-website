/**
 * Owner-tracked walks/training sessions — real `walks` + `homework_completions`
 * tables (see the "walk_tracker" migration), separate from the trainer-booked
 * `training_sessions`. A walk row is created the moment you hit Start (so
 * homework marked off mid-walk has something to link to) and updated when
 * you stop.
 */
import { supabase } from "@/lib/supabase";
import { createPost } from "@/lib/community";

export type WalkKind = "walk" | "training";

export type Walk = {
  id: string;
  dogId: string;
  kind: WalkKind;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  notes: string;
  sharedPostId: string | null;
};

export type HomeworkItem = {
  id: string;
  drillName: string;
  note: string;
  pillar: string | null;
  category: string | null;
};

/** Start a walk/training session — inserts immediately so homework marks have a walk to link to. */
export async function startWalk(input: {
  dogId: string;
  kind: WalkKind;
  location: { lat: number; lng: number } | null;
}): Promise<Walk | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("walks")
    .insert({
      account_id: user.id,
      dog_id: input.dogId,
      kind: input.kind,
      start_lat: input.location?.lat ?? null,
      start_lng: input.location?.lng ?? null,
    })
    .select("id, dog_id, kind, started_at, ended_at, duration_seconds, notes, shared_post_id")
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    dogId: data.dog_id,
    kind: data.kind,
    startedAt: data.started_at,
    endedAt: data.ended_at,
    durationSeconds: data.duration_seconds,
    notes: data.notes ?? "",
    sharedPostId: data.shared_post_id,
  };
}

/** Stop a walk — records the duration and any notes. */
export async function finishWalk(
  walkId: string,
  input: { durationSeconds: number; notes: string }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("walks")
    .update({ ended_at: new Date().toISOString(), duration_seconds: input.durationSeconds, notes: input.notes })
    .eq("id", walkId);
  return { error: error?.message ?? null };
}

/** Mark a homework item as practiced — a repeatable log entry, not a one-off checkbox. */
export async function markHomeworkDone(dogId: string, reportCardItemId: string, walkId: string | null) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("homework_completions").insert({
    dog_id: dogId,
    report_card_item_id: reportCardItemId,
    walk_id: walkId,
    completed_by: user.id,
  });
}

/** This dog's current homework — the items on their most recent published report card. */
export async function getHomeworkForDog(dogId: string): Promise<HomeworkItem[]> {
  const { data: card } = await supabase
    .from("report_cards")
    .select("id")
    .eq("dog_id", dogId)
    .eq("status", "published")
    .order("session_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!card) return [];

  const { data: items } = await supabase
    .from("report_card_items")
    .select("id, drill_name, note, pillar, category")
    .eq("report_card_id", card.id)
    .order("sort_order");

  return (items ?? []).map((i) => ({
    id: i.id,
    drillName: i.drill_name,
    note: i.note ?? "",
    pillar: i.pillar,
    category: i.category,
  }));
}

/** Past walks for a dog, newest first. */
export async function getWalks(dogId: string): Promise<Walk[]> {
  const { data } = await supabase
    .from("walks")
    .select("id, dog_id, kind, started_at, ended_at, duration_seconds, notes, shared_post_id")
    .eq("dog_id", dogId)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false });

  return (data ?? []).map((d) => ({
    id: d.id,
    dogId: d.dog_id,
    kind: d.kind,
    startedAt: d.started_at,
    endedAt: d.ended_at,
    durationSeconds: d.duration_seconds,
    notes: d.notes ?? "",
    sharedPostId: d.shared_post_id,
  }));
}

/** Share a finished walk to the community feed, then link the post back to it. */
export async function shareWalkToCommunity(walk: Walk, dogName: string): Promise<{ error: string | null }> {
  const mins = Math.round((walk.durationSeconds ?? 0) / 60);
  const label = walk.kind === "training" ? "training session" : "walk";
  const lines = [`🐾 ${mins} min ${label} with ${dogName}.`];
  if (walk.notes.trim()) lines.push(walk.notes.trim());
  const body = lines.join("\n\n");

  const { error, postId } = await createPost(body);
  if (error) return { error };

  // Best-effort link-back — the post itself is already live either way.
  if (postId) {
    await supabase.from("walks").update({ shared_post_id: postId }).eq("id", walk.id);
  }

  return { error: null };
}
