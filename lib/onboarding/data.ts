/**
 * Data-access seams for the onboarding lifecycle. Each maps to a backend
 * operation; wiring Supabase + GoCardless means filling in these bodies.
 *
 * Intended backend:
 *   - startOnboarding(rec)          → insert onboarding row (status in_progress),
 *                                      linked to the customer account + slot
 *   - markWaiverSigned(dogId)       → update onboarding set waiver_signed = true
 *                                      (called when the customer submits /waiver)
 *   - setupPayment(dogId)           → create a GoCardless mandate; on the
 *                                      webhook success set payment_set = true
 *   - confirmPlacement(dogId, date) → set status = confirmed + start_date, flip
 *                                      the schedule slot to permanent, and send
 *                                      the customer their confirmation email
 */
import type { OnboardingRecord } from "./types";

export async function startOnboarding(rec: OnboardingRecord): Promise<void> {
  // TODO(backend): insert into onboarding (dog_id, owner, email, day, cadence, ...)
  console.log(`[onboarding] started ${rec.dogId} (${rec.dogName}) (scaffold)`);
}

export async function markWaiverSigned(dogId: string): Promise<void> {
  // TODO(backend): update onboarding set waiver_signed = true where dog_id = $1
  console.log(`[onboarding] waiver signed ${dogId} (scaffold)`);
}

export async function setupPayment(dogId: string): Promise<void> {
  // TODO(backend): create GoCardless mandate for this customer; the mandate
  // webhook flips payment_set = true.
  console.log(`[onboarding] payment set up ${dogId} (scaffold)`);
}

export async function confirmPlacement(dogId: string, startDate: string): Promise<void> {
  // TODO(backend): set status = confirmed + start_date; slot → permanent; email.
  console.log(`[onboarding] placement confirmed ${dogId} @ ${startDate} (scaffold)`);
}
