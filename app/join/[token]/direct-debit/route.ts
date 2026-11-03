import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSetupPageUrl } from "@/lib/gocardless/client";

type Status = { name: string; email: string; directDebit: string; billingRequestId: string | null } | null;

/**
 * "Set up Direct Debit" on the join page: makes a fresh GoCardless page for
 * this owner's set-up request and sends them to it. GoCardless brings them
 * back to /join/<token>?dd=done when they've finished.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const origin = request.nextUrl.origin;
  const back = (q = "") => NextResponse.redirect(new URL(`/join/${encodeURIComponent(token)}${q}`, origin), 303);

  const supabase = await createClient();
  const { data } = await supabase.rpc("nn_onboarding_status", { p_token: token });
  const status = data as Status;
  if (!status?.billingRequestId) return back();
  if (!["none", "link_sent"].includes(status.directDebit)) return back();

  try {
    const [givenName, ...rest] = status.name.trim().split(/\s+/);
    const url = await createSetupPageUrl({
      billingRequestId: status.billingRequestId,
      redirectUri: `${origin}/join/${encodeURIComponent(token)}?dd=done`,
      exitUri: `${origin}/join/${encodeURIComponent(token)}`,
      prefill: { givenName, familyName: rest.join(" "), email: status.email },
    });
    return NextResponse.redirect(url, 303);
  } catch (err) {
    console.error("join direct-debit: couldn't open GoCardless", err);
    return back("?dd=error");
  }
}
