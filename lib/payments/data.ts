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
