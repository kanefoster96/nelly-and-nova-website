import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { requireTrainer } from "@/lib/records/server";
import { sendEmail } from "@/lib/email/resend";
import { onboardingStarted } from "@/lib/email/templates";
import { createMandateRequest, gocardlessConfigured, GoCardlessError } from "@/lib/gocardless/client";

/**
 * Trainer: "Start onboarding" on a meet & greet request, once you've met and
 * agreed to work together. Gives the request a private join link, creates a
 * GoCardless Direct Debit set-up for it (nothing is charged — you set up
 * payments in GoCardless yourself), and sends the owner the link by email,
 * plus in their chat if they already have an account. Pressing it again
 * re-sends the same link rather than starting over.
 */
export async function POST(request: Request) {
  const denied = await requireTrainer();
  if (denied) return denied;
  if (!gocardlessConfigured()) {
    return Response.json({ error: "GoCardless isn't connected yet." }, { status: 503 });
  }

  let body: { enquiryId?: string; sendEmail?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const enquiryId = String(body.enquiryId ?? "");
  if (!/^[0-9a-f-]{36}$/.test(enquiryId)) return Response.json({ error: "Invalid request." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: e, error: loadError } = await supabase
    .from("enquiries")
    .select("id, name, email, dog_names, details, account_id, onboarding_token, status")
    .eq("id", enquiryId)
    .maybeSingle();
  if (loadError || !e) return Response.json({ error: "Couldn't find that request." }, { status: 404 });

  // 1) The join link (kept if it already has one).
  const token = e.onboarding_token ?? randomBytes(24).toString("base64url");

  // 2) A Direct Debit set-up — reused if one is already on the go.
  const { data: existing } = await supabase
    .from("payment_mandates")
    .select("id, status")
    .eq("enquiry_id", e.id)
    .not("status", "in", "(failed,cancelled,expired)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing) {
    try {
      const br = await createMandateRequest({ enquiryId: e.id });
      const { error: insertError } = await supabase.from("payment_mandates").insert({
        enquiry_id: e.id,
        account_id: e.account_id,
        billing_request_id: br.id,
        status: "link_sent",
        created_by: user?.id ?? null,
      });
      if (insertError) throw new Error(insertError.message);
    } catch (err) {
      console.error("start onboarding: GoCardless set-up failed", err);
      const msg = err instanceof GoCardlessError ? `GoCardless said: ${err.message}` : "Couldn't create the Direct Debit set-up.";
      return Response.json({ error: msg }, { status: 502 });
    }
  }

  const { error: updateError } = await supabase
    .from("enquiries")
    .update({ status: "onboarding", onboarding_token: token, onboarding_started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", e.id);
  if (updateError) return Response.json({ error: "Couldn't update the request." }, { status: 500 });

  const origin = new URL(request.url).origin;
  const joinUrl = `${origin}/join/${token}`;
  const dogNames = String(e.dog_names ?? "").replace(/, ([^,]*)$/, " & $1");

  // 3) Tell them: email, and their chat if they have an account.
  let emailed = false;
  if (body.sendEmail !== false) {
    emailed = await sendEmail(onboardingStarted({ name: e.name, email: e.email, dogNames, joinUrl }));
  }
  let messaged = false;
  if (e.account_id) {
    const { data: conversationId } = await supabase.rpc("nn_chat_conversation_for", { p_account_id: e.account_id });
    if (conversationId) {
      const { error } = await supabase.rpc("nn_chat_send", {
        p_conversation_id: conversationId,
        p_body: `Lovely meeting ${dogNames || "your dog"}! Here's everything to do before your first session — set up your Direct Debit, then register ${dogNames || "your dog"}: ${joinUrl}`,
      });
      messaged = !error;
    }
  }

  return Response.json({ ok: true, joinUrl, emailed, messaged });
}
