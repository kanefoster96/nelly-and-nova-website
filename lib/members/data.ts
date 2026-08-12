/**
 * Data-access seam for member accounts (admin).
 * Intended backend (Supabase + GoCardless):
 *   - cancelAccount(id) → mark the account inactive, stop the GoCardless
 *     mandate, and release their schedule slot.
 */
export async function cancelAccount(memberId: string): Promise<void> {
  // TODO(backend): update members set status='cancelled'; cancel mandate;
  // delete their schedule_slots row.
  console.log(`[members] cancelled account ${memberId} (scaffold)`);
}
