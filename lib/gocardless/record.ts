import { createClient as createSupabase } from "@supabase/supabase-js";
import { getBillingRequest, getMandateStatus } from "./client";

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
