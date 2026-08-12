/**
 * Payment seams (GoCardless).
 * Intended backend:
 *   - chargeForSession(dogId, …) → create a GoCardless payment against the
 *     customer's existing mandate (e.g. an approved extra session).
 */
export async function chargeForSession(
  dogId: string,
  opts: { reason: string; service?: string }
): Promise<void> {
  // TODO(backend): POST a GoCardless payment on the customer's mandate.
  console.log(`[payments] charge ${dogId} — ${opts.reason}${opts.service ? ` (${opts.service})` : ""} (scaffold GoCardless)`);
}

/**
 * Retry a failed session payment (customer resubmits, or coach re-requests).
 * TODO(backend): create a fresh GoCardless payment on the mandate; the webhook
 * updates the status when it settles.
 */
export async function retryCharge(dogId: string, date: string): Promise<void> {
  // TODO(backend): create a new GoCardless payment for this session.
  console.log(`[payments] retry ${dogId} @ ${date} (scaffold GoCardless)`);
}
