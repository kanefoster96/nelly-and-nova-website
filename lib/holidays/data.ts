/**
 * Holidays backend seam (scaffold).
 * ---------------------------------
 * Client-callable stand-ins for the server. Today they just log; the store
 * calls them alongside its local write so the wiring is ready for Supabase.
 * The public holidays page, the customer "holiday used" ledger and the reminder
 * schedule all hang off these.
 */
import type { Holiday, HolidayCustomer } from "./types";

/** Persist a new closure and mark one holiday used against each active member. */
export async function publishHoliday(h: Holiday, customers: HolidayCustomer[]): Promise<void> {
  // TODO(backend): insert into holidays (start, end, reason); then for each
  //   active member insert a holiday_usage row (member_id, holiday_id, year) —
  //   UNIQUE(member_id, holiday_id) so a member with two dogs / two sessions in
  //   the week is still only charged one holiday. A DB CHECK / count guard keeps
  //   any member from exceeding ANNUAL_HOLIDAY_ALLOWANCE per calendar year.
  console.log(
    `[holidays] published ${h.start}→${h.end} — ${customers.length} members each +1 holiday used (scaffold)`
  );
}

/** Remove a closure and give everyone that holiday back. */
export async function unpublishHoliday(id: string): Promise<void> {
  // TODO(backend): delete from holidays where id = $1 (cascade holiday_usage).
  console.log(`[holidays] removed ${id} (scaffold)`);
}

/**
 * Schedule the two reminder emails for a closure. These are time-based sends a
 * cron/queue owns — we only record the intent here.
 */
export async function scheduleHolidayReminders(
  h: Holiday,
  customers: HolidayCustomer[]
): Promise<void> {
  // TODO(backend): enqueue two jobs off this holiday:
  //   1. One week before `h.start` — send `holidayWeekBeforeReminder` to every
  //      member (a heads-up the closure is coming).
  //   2. The day before each affected session date in [h.start, h.end] — send
  //      `holidaySessionSkipped` to that member only, so they're reminded their
  //      session isn't on. (Derive affected dates from each member's training
  //      day that falls inside the range.)
  //   The immediate "we're closed that week" notice is sent now via
  //   /api/holidays/notice; these two are the scheduled follow-ups.
  console.log(
    `[holidays] scheduled reminders for ${h.start}→${h.end} to ${customers.length} members (scaffold)`
  );
}
