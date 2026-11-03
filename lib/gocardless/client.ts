/**
 * GoCardless, from the server only (API routes). The access token never
 * reaches a browser.
 *
 * Settings (Vercel → Environment Variables, Production):
 *   GOCARDLESS_ACCESS_TOKEN   read-write token (live_… or sandbox_…)
 *   GOCARDLESS_ENVIRONMENT    "live" or "sandbox"
 *   GOCARDLESS_WEBHOOK_SECRET the secret GoCardless shows for the webhook
 *   GOCARDLESS_RELAY_SECRET   lets the webhook update payment_mandates
 *
 * The GoCardless account also has customers this site didn't create. The
 * site only ever acts on IDs it saved in payment_mandates itself; nothing
 * here lists or searches the account.
 */

const API_VERSION = "2015-07-06";

export function gocardlessConfigured(): boolean {
  return Boolean(process.env.GOCARDLESS_ACCESS_TOKEN);
}

function baseUrl(): string {
  return process.env.GOCARDLESS_ENVIRONMENT === "sandbox"
    ? "https://api-sandbox.gocardless.com"
    : "https://api.gocardless.com";
}

export class GoCardlessError extends Error {
  constructor(message: string, readonly status: number, readonly details?: unknown) {
    super(message);
  }
}

async function gc<T>(method: "GET" | "POST", path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const token = process.env.GOCARDLESS_ACCESS_TOKEN;
  if (!token) throw new GoCardlessError("GoCardless isn't connected yet.", 503);
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "GoCardless-Version": API_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; errors?: unknown } } & T;
  if (!res.ok) {
    console.error(`GoCardless ${method} ${path} failed`, res.status, JSON.stringify(json.error ?? json).slice(0, 2000));
    throw new GoCardlessError(json.error?.message ?? `GoCardless error ${res.status}`, res.status, json.error?.errors);
  }
  return json;
}

/** Everything the site creates is tagged so it's easy to spot in the dashboard. */
const SOURCE = { source: "nelly-and-nova-website" };

export type BillingRequest = {
  id: string;
  status: string; // pending | ready_to_fulfil | fulfilling | fulfilled | cancelled
  links?: { customer?: string; mandate_request_mandate?: string };
};

/** A Direct Debit (Bacs, GBP) set-up request, nothing charged. */
export async function createMandateRequest(opts: { enquiryId: string }): Promise<BillingRequest> {
  const json = await gc<{ billing_requests: BillingRequest }>(
    "POST",
    "/billing_requests",
    {
      billing_requests: {
        mandate_request: { scheme: "bacs", currency: "GBP" },
        metadata: { ...SOURCE, enquiry_id: opts.enquiryId },
      },
    },
    `nn-brq-${opts.enquiryId}-${Date.now()}`
  );
  return json.billing_requests;
}

/**
 * GoCardless's own secure page for a set-up request. Made fresh each time
 * the owner taps the button, so a link never goes stale.
 */
export async function createSetupPageUrl(opts: {
  billingRequestId: string;
  redirectUri: string;
  exitUri: string;
  prefill: { givenName?: string; familyName?: string; email?: string; postalCode?: string };
}): Promise<string> {
  const json = await gc<{ billing_request_flows: { authorisation_url: string } }>("POST", "/billing_request_flows", {
    billing_request_flows: {
      redirect_uri: opts.redirectUri,
      exit_uri: opts.exitUri,
      links: { billing_request: opts.billingRequestId },
      prefilled_customer: {
        given_name: opts.prefill.givenName || undefined,
        family_name: opts.prefill.familyName || undefined,
        email: opts.prefill.email || undefined,
        postal_code: opts.prefill.postalCode || undefined,
      },
    },
  });
  return json.billing_request_flows.authorisation_url;
}

export async function getBillingRequest(id: string): Promise<BillingRequest> {
  const json = await gc<{ billing_requests: BillingRequest }>("GET", `/billing_requests/${encodeURIComponent(id)}`);
  return json.billing_requests;
}

export async function getMandateStatus(id: string): Promise<string> {
  const json = await gc<{ mandates: { status: string } }>("GET", `/mandates/${encodeURIComponent(id)}`);
  return json.mandates.status;
}

/** Cancels a Direct Debit the site set up (stops anything collecting on it). Already cancelled is fine. */
export async function cancelMandate(id: string): Promise<void> {
  try {
    await gc("POST", `/mandates/${encodeURIComponent(id)}/actions/cancel`, { data: { metadata: { reason: "account_deleted" } } });
  } catch (err) {
    if (err instanceof GoCardlessError && (err.status === 422 || err.status === 404)) return; // already cancelled / gone
    throw err;
  }
}
