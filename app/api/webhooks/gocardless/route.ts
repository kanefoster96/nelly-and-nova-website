import { createHmac, timingSafeEqual } from "node:crypto";
import { firstTimeEvent, recordMandate, recordPaymentEvent } from "@/lib/gocardless/record";
import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { pushNotices } from "@/lib/sessions/push";

/**
 * GoCardless webhook — the one address GoCardless sends every event to:
 *   https://<site>/api/webhooks/gocardless
 *
 * Checks the Webhook-Signature with GOCARDLESS_WEBHOOK_SECRET, handles each
 * event once, and only ever updates Direct Debits this site set up
 * (nn_gc_record ignores everything else) — so events about your existing
 * GoCardless customers pass straight through untouched.
 *
 * Handled: Direct Debit set-up finished, mandate status changes, and
 * payments: a session a trainer charged (app/api/sessions/charge) goes paid
 * (confirmed, paid_out) or failed (failed, cancelled, charged_back); a
 * failed payment on one of our mandates that isn't a session (a
 * membership) is flagged and the trainers are told. Everything else is
 * acknowledged and left alone.
 */

type GcEvent = {
  id: string;
  resource_type: string;
  action: string;
  links?: { mandate?: string; billing_request?: string; customer?: string; mandate_request_mandate?: string; payment?: string };
};

// Mandate event → the status we keep (GoCardless's own status names).
const MANDATE_STATUS: Record<string, string> = {
  created: "pending_submission",
  customer_approval_granted: "pending_submission",
  submitted: "submitted",
  active: "active",
  reinstated: "active",
  resubmission_requested: "pending_submission",
  failed: "failed",
  cancelled: "cancelled",
  expired: "expired",
  consumed: "consumed",
  blocked: "blocked",
  suspended_by_payer: "suspended_by_payer",
};

// Payment events that change what we show: paid, or failed.
const PAYMENT_ACTIONS = new Set(["confirmed", "paid_out", "failed", "cancelled", "charged_back"]);

function validSignature(body: string, signature: string | null): boolean {
  const secret = process.env.GOCARDLESS_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const body = await request.text();
  if (!validSignature(body, request.headers.get("Webhook-Signature"))) {
    // GoCardless's convention for a bad signature.
    return new Response("Invalid signature", { status: 498 });
  }

  let events: GcEvent[] = [];
  try {
    events = (JSON.parse(body) as { events?: GcEvent[] }).events ?? [];
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  for (const ev of events) {
    try {
      if (!(await firstTimeEvent(ev.id))) continue;

      if (ev.resource_type === "billing_requests" && ev.action === "fulfilled") {
        await recordMandate({
          billingRequestId: ev.links?.billing_request ?? null,
          mandateId: ev.links?.mandate_request_mandate ?? null,
          customerId: ev.links?.customer ?? null,
          status: "pending_submission",
        });
      } else if (ev.resource_type === "mandates" && ev.links?.mandate && MANDATE_STATUS[ev.action]) {
        await recordMandate({ mandateId: ev.links.mandate, status: MANDATE_STATUS[ev.action] });
      } else if (ev.resource_type === "payments" && ev.links?.payment && PAYMENT_ACTIONS.has(ev.action)) {
        const notices = await recordPaymentEvent({ paymentId: ev.links.payment, mandateId: ev.links.mandate ?? null, action: ev.action });
        if (notices.length && adminConfigured()) await pushNotices(createAdminClient(), notices, null);
      }
      // Everything else (subscriptions, refunds, payouts…) is acknowledged.
    } catch (err) {
      // Never fail the whole batch for one event — GoCardless would resend
      // all of them. Log it and carry on.
      console.error(`gocardless webhook: event ${ev.id} failed`, err);
    }
  }

  return new Response(null, { status: 204 });
}
