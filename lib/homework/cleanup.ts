import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Homework videos are only kept until the homework is complete (done on 3
 * different days): then they're deleted from the private homework-videos
 * bucket and their path cleared, keeping each day's note and date. The chat
 * message that carried a video stays and shows "Video removed — homework
 * completed". See supabase/migrations/20261104080000_owner_onboarding.sql.
 *
 * `admin` is the service-role client: deleting storage files needs the
 * Storage API with that key. Returns how many files went.
 */
export const HOMEWORK_VIDEO_BUCKET = "homework-videos";
const TARGET_DAYS = 3;

export async function removeHomeworkVideos(admin: SupabaseClient, cardId: string, paths: string[]): Promise<number> {
  const clean = paths.filter((p) => typeof p === "string" && p.length > 0 && p.length <= 300 && !p.includes(".."));
  if (clean.length === 0) return 0;
  const { error } = await admin.storage.from(HOMEWORK_VIDEO_BUCKET).remove(clean);
  if (error) {
    console.error("removeHomeworkVideos: storage remove failed", error.message);
    return 0;
  }
  const { error: updateError } = await admin
    .from("homework_days")
    .update({ video_path: null, video_removed_at: new Date().toISOString() })
    .eq("report_card_id", cardId)
    .in("video_path", clean);
  if (updateError) console.error("removeHomeworkVideos: clearing paths failed", updateError.message);
  return clean.length;
}

/** The daily sweep: every completed homework that still has videos. */
export async function sweepCompletedHomeworkVideos(admin: SupabaseClient): Promise<number> {
  const { data: withVideos, error } = await admin.from("homework_days").select("report_card_id, video_path").not("video_path", "is", null).limit(1000);
  if (error || !withVideos?.length) return 0;
  const cards = [...new Set(withVideos.map((r) => r.report_card_id as string))];
  const { data: days } = await admin.from("homework_days").select("report_card_id").in("report_card_id", cards);
  const count = new Map<string, number>();
  for (const d of days ?? []) count.set(d.report_card_id as string, (count.get(d.report_card_id as string) ?? 0) + 1);
  let removed = 0;
  for (const card of cards) {
    if ((count.get(card) ?? 0) < TARGET_DAYS) continue;
    const paths = withVideos.filter((r) => r.report_card_id === card).map((r) => r.video_path as string);
    removed += await removeHomeworkVideos(admin, card, paths);
  }
  return removed;
}
