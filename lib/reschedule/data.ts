/**
 * Data-access seams for reschedule requests.
 * Intended backend (Supabase):
 *   - submitReschedule(req)          → insert into reschedule_requests (pending)
 *                                       + notify staff
 *   - decideReschedule(id, status,…) → update status (+ edited day/date); on
 *                                       'approved', write a session exception so
 *                                       the member's schedule reflects the move,
 *                                       and notify the member
 */
import type { RescheduleRequest, RescheduleStatus } from "./types";

export async function submitReschedule(req: RescheduleRequest): Promise<void> {
  // TODO(backend): insert into reschedule_requests (...); notify staff.
  console.log(`[reschedule] ${req.dogName}: ${req.sessionDate} → ${req.toDate} (scaffold)`);
}

export async function decideReschedule(
  id: string,
  status: RescheduleStatus,
  patch: Partial<Pick<RescheduleRequest, "toDay" | "toDate">> = {}
): Promise<void> {
  // TODO(backend): update reschedule_requests set status = $2, to_day/to_date;
  // on approve add a session exception + notify the member.
  console.log(`[reschedule] ${id} → ${status}`, patch, "(scaffold)");
}
