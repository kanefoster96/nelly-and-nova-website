/**
 * Heat-day backend seam (scaffold). The store calls these when a trainer marks
 * or clears a heat day; today they just log. TODO(backend): persist to a
 * `heat_days` table and enqueue notifications to everyone with a session that
 * date (the client already POSTs /api/heat/notice for the email fan-out).
 */
import type { HeatDay } from "./types";

export type HeatRecipient = { ownerName: string; email?: string; dogNames: string[] };

export async function publishHeatDay(day: HeatDay, recipients: HeatRecipient[]) {
  console.log(
    `[heat] marked ${day.date} as a heat day — would notify ${recipients.length} owner(s) of the earlier times (not persisted, scaffold)`
  );
}

export async function unpublishHeatDay(date: string) {
  console.log(`[heat] cleared heat day ${date} (scaffold)`);
}
