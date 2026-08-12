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
 * Set up the recurring GoCardless subscription for a permanent member. Charges
 * land the day before each session, the same day/time weekly (or every other
 * week for alternating). Rescheduling a single session does NOT change this
 * subscription — only extra sessions add a one-off charge on confirmation.
 * TODO(backend): create a GoCardless subscription (day_of_month/day-before,
 * interval by cadence) starting the cycle before the first session.
 */
export async function scheduleSubscription(
  dogId: string,
  opts: { sessionDay: string; cadence: string; startDate: string; chargeDay: string }
): Promise<void> {
  console.log(
    `[payments] subscription ${dogId}: charge ${opts.chargeDay} (day before ${opts.sessionDay}), ${opts.cadence}, from ${opts.startDate} (scaffold GoCardless)`
  );
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

/**
 * Refund a collected payment (full or partial) back to the customer's bank
 * account via GoCardless. No card details are needed — the refund uses the
 * existing mandate and lands in the same account the money came from.
 * TODO(backend): POST /refunds with { links.payment, amount (pence),
 * total_amount_confirmation }. Refunds must be enabled on the account and
 * respect GoCardless's refund limits / 7-day window.
 */
export async function refundPayment(
  dogId: string,
  date: string,
  opts: { amount: number; full: boolean; note?: string }
): Promise<void> {
  console.log(
    `[payments] refund ${dogId} @ ${date} — £${opts.amount} ${opts.full ? "(full)" : "(partial)"}${opts.note ? ` — ${opts.note}` : ""} (scaffold GoCardless)`
  );
}

/**
 * Cancel a payment that hasn't been submitted to the bank yet — cleaner than a
 * refund because no money moves. Use this when the charge is still pending
 * (e.g. a session cancelled before its day-before charge is taken).
 * TODO(backend): POST /payments/:id/actions/cancel (only valid while
 * pending_submission).
 */
export async function cancelPayment(dogId: string, date: string): Promise<void> {
  console.log(`[payments] cancel pending charge ${dogId} @ ${date} (scaffold GoCardless)`);
}
