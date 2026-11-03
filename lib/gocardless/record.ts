import { createClient as createSupabase } from "@supabase/supabase-js";
import { getBillingRequest, getMandateStatus, getPaymentMandate } from "./client";

/**
 * Writing GoCardless progress back to payment_mandates without a signed-in
 * user (the webhook, or the owner coming back from GoCardless). Goes through
 * nn_gc_record, which only updates rows the site created and checks the
 * shared GOCARDLESS_RELAY_SECRET.
 */
function anonClient() {
  return createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function recordMandate(opts: {
  billingRequestId?: string | null;
  mandateId?: string | null;
  customerId?: string | null;
  status?: string | null;
}): Promise<boolean> {
  const secret = process.env.GOCARDLESS_RELAY_SECRET;
  if (!secret) {
    console.error("recordMandate: GOCARDLESS_RELAY_SECRET isn't set");
    return false;
  }
  const { data, error } = await anonClient().rpc("nn_gc_record", {
    p_secret: secret,
    p_billing_request_id: opts.billingRequestId ?? null,
    p_mandate_id: opts.mandateId ?? null,
    p_customer_id: opts.customerId ?? null,
    p_status: opts.status ?? null,
  });
  if (error) console.error("recordMandate failed", error.message);
  return data === true;
}

/** True the first time GoCardless sends this event id (they can resend). */
export async function firstTimeEvent(eventId: string): Promise<boolean> {
  const secret = process.env.GOCARDLESS_RELAY_SECRET;
  if (!secret) return false;
  const { data, error } = await anonClient().rpc("nn_gc_event_first_time", { p_secret: secret, p_event_id: eventId });
  if (error) {
    console.error("firstTimeEvent failed", error.message);
    return true; // better to process twice (it's idempotent) than drop it
  }
  return data === true;
}

/**
 * Ask GoCardless where a set-up request has got to and save it. Used when
 * the owner comes back from GoCardless's page, so the join page is right
 * straight away without waiting for the webhook.
 */
export async function refreshFromBillingRequest(billingRequestId: string): Promise<string | null> {
  try {
    const br = await getBillingRequest(billingRequestId);
    const mandateId = br.links?.mandate_request_mandate ?? null;
    if (br.status !== "fulfilled" || !mandateId) return null;
    const status = await getMandateStatus(mandateId).catch(() => "pending_submission");
    await recordMandate({ billingRequestId, mandateId, customerId: br.links?.customer ?? null, status });
    return status;
  } catch (err) {
    console.error("refreshFromBillingRequest failed", err);
    return null;
  }
}

/**
 * A payment event (resource_type "payments"). nn_gc_payment_event marks a
 * session's payment paid or failed when its id is saved on a booking; a
 * failed payment on a mandate we hold that isn't a session (a membership)
 * is recorded in payment_failures and the trainers are told. Anything
 * else is ignored. Payment events don't always carry the mandate, so for
 * a failure that isn't a session it's looked up (read only). Returns the
 * notification ids made, to push.
 */
export async function recordPaymentEvent(opts: { paymentId: string; mandateId?: string | null; action: string }): Promise<string[]> {
  const secret = process.env.GOCARDLESS_RELAY_SECRET;
  if (!secret) {
    console.error("recordPaymentEvent: GOCARDLESS_RELAY_SECRET isn't set");
    return [];
  }
  const call = async (mandateId: string | null) => {
    const { data, error } = await anonClient().rpc("nn_gc_payment_event", {
      p_secret: secret,
      p_payment_id: opts.paymentId,
      p_mandate_id: mandateId,
      p_action: opts.action,
    });
    if (error) console.error("recordPaymentEvent failed", error.message);
    return (data ?? null) as { kind?: string; notices?: unknown } | null;
  };
  let result = await call(opts.mandateId ?? null);
  if (result?.kind === "ignored" && !opts.mandateId && (opts.action === "failed" || opts.action === "charged_back")) {
    const mandateId = await getPaymentMandate(opts.paymentId).catch(() => null);
    if (mandateId) result = await call(mandateId);
  }
  const notices = result?.notices;
  return Array.isArray(notices) ? notices.filter((x): x is string => typeof x === "string") : [];
}
