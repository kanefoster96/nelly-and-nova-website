import { callerClient } from "@/lib/sessions/auth";
import { createSetupPageUrl, gocardlessConfigured } from "@/lib/gocardless/client";
import { refreshFromBillingRequest } from "@/lib/gocardless/record";

type MyOnboarding = {
  enquiry: { name: string | null; email: string | null } | null;
  directDebit: string;
  billingRequestId: string | null;
} | null;

/** Statuses that mean the owner has finished GoCardless's page. */
const DD_DONE = ["pending_submission", "submitted", "active"];

/**
 * The app's "Set up Direct Debit" step (and the website's, signed in): the
 * signed-in owner's own Direct Debit set-up, found through nn_my_onboarding
 * (auth.uid() only, so nobody can open or refresh anyone else's).
 * Signed in by a Bearer token (the app) or the website's cookie.
 *
 * Body: { action: "open" | "refresh" }
 *   open     a fresh GoCardless page for their set-up request, which
 *            comes back to /direct-debit/done ("All done — go back to the
 *            app"). Already finished: { done: true } and nothing to open.
 *   refresh  ask GoCardless where it has got to and save it (the app does
 *            this when it comes back to the front), then the status.
 */
export async function POST(request: Request) {
  const supabase = await callerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  const action = body?.action === "refresh" ? "refresh" : "open";

  const load = async () => (await supabase.rpc("nn_my_onboarding")).data as MyOnboarding;
  let status = await load();
  if (!status?.billingRequestId) {
    return Response.json(
      { error: "Your Direct Debit isn't ready yet — we'll set it up after your meet & greet.", directDebit: status?.directDebit ?? "none" },
      { status: 404 }
    );
  }

  if (action === "refresh") {
    if (!DD_DONE.includes(status.directDebit) && gocardlessConfigured()) {
      await refreshFromBillingRequest(status.billingRequestId);
      status = (await load()) ?? status;
    }
    return Response.json({ ok: true, directDebit: status.directDebit });
  }

  if (!["none", "link_sent"].includes(status.directDebit)) {
    return Response.json({ ok: true, done: true, directDebit: status.directDebit });
  }
  if (!gocardlessConfigured()) return Response.json({ error: "Direct Debits aren't switched on just now. Please message us." }, { status: 503 });

  try {
    const origin = new URL(request.url).origin;
    const back = new URL("/direct-debit/done", origin);
    back.searchParams.set("br", status.billingRequestId);
    const exit = new URL("/direct-debit/done", origin);
    exit.searchParams.set("left", "1");
    const [givenName, ...rest] = (status.enquiry?.name ?? "").trim().split(/\s+/);
    const url = await createSetupPageUrl({
      billingRequestId: status.billingRequestId,
      redirectUri: back.toString(),
      exitUri: exit.toString(),
      prefill: { givenName, familyName: rest.join(" "), email: status.enquiry?.email ?? user.email ?? undefined },
    });
    return Response.json({ ok: true, url, directDebit: status.directDebit });
  } catch (err) {
    console.error("onboarding direct-debit: couldn't open GoCardless", err);
    return Response.json({ error: "We couldn't open GoCardless just now. Please try again in a moment." }, { status: 502 });
  }
}
