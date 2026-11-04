import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Photos from a dog's day are kept 90 days. The daily cron
 * (app/api/cron/register-reminders) deletes older files from the private
 * day-photos bucket with the service role (SQL can't delete from
 * storage.objects), then their day_photos rows, plus the old "📸 New
 * photos" claims and evening-reminder log rows. See
 * supabase/migrations/20261104110000_owner_flow.sql.
 */
export const DAY_PHOTO_BUCKET = "day-photos";
export const DAY_PHOTO_KEEP_DAYS = 90;

export async function sweepOldDayPhotos(admin: SupabaseClient, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - DAY_PHOTO_KEEP_DAYS * 86_400_000);
  let removed = 0;
  // A few rounds of up to 500, so a big backlog clears over a couple of days without timing out.
  for (let round = 0; round < 4; round++) {
    const { data, error } = await admin.from("day_photos").select("id, path").lt("created_at", cutoff.toISOString()).limit(500);
    if (error) {
      console.error("sweepOldDayPhotos: listing failed", error.message);
      break;
    }
    const rows = (data ?? []) as { id: string; path: string }[];
    if (rows.length === 0) break;
    const { error: removeError } = await admin.storage.from(DAY_PHOTO_BUCKET).remove(rows.map((r) => r.path));
    if (removeError) {
      console.error("sweepOldDayPhotos: storage remove failed", removeError.message);
      break;
    }
    const { error: deleteError } = await admin.from("day_photos").delete().in("id", rows.map((r) => r.id));
    if (deleteError) {
      console.error("sweepOldDayPhotos: deleting rows failed", deleteError.message);
      break;
    }
    removed += rows.length;
    if (rows.length < 500) break;
  }
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  await admin.from("day_photo_notices").delete().lt("on_date", cutoffDate);
  await admin.from("owner_reminders_sent").delete().lt("on_date", cutoffDate);
  return removed;
}
