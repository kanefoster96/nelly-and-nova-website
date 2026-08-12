/**
 * Data-access seam for the Final Consent & Waiver.
 * Intended backend (Supabase + storage):
 *   - submitWaiver(data) → insert a `waivers` row (owner + dog details, health
 *     answers, agreement, typed name, date, signature image), store the
 *     uploaded vaccination record, and mark the customer's onboarding waiver
 *     complete (which lets a coach confirm their held schedule slot).
 */
import type { WaiverData } from "./draft";

export async function submitWaiver(data: WaiverData): Promise<void> {
  // TODO(backend): insert into waivers (...); upload vaccination file + signature;
  // set onboarding.waiver_signed = true for this customer.
  console.log(`[waiver] submitted for ${data.clientName || data.firstName} (scaffold)`);
}
