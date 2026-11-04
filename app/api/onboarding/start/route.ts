import { randomBytes } from "node:crypto";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { onboardingStarted } from "@/lib/email/templates";
import { createMandateRequest, gocardlessConfigured, GoCardlessError } from "@/lib/gocardless/client";
import { notifyAccount } from "@/lib/notifications/send";

/**
 * Trainer: "Start onboarding" on a meet & greet request, once you've met and
 * agreed to work together. Gives the request a private join link, creates a
 * GoCardless Direct Debit set-up for it (nothing is charged — you set up
 * payments in GoCardless yourself), and sends the owner the link by email,
 * plus in their chat if they already have an account. Pressing it again
 * re-sends the same link rather than starting over.
 */
/** Signed in by cookie (website) or "Authorization: Bearer <token>" (the app). */
async function requestClient(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!bearer) return createClient();
  return createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];

export async function POST(request: Request) {
  const supabase = await requestClient(request);
  const { data: isTrainer } = await supabase.rpc("nn_is_admin");
  if (isTrainer !== true) return Response.json({ error: "Trainers only." }, { status: 403 });
  if (!gocardlessConfigured()) {
    return Response.json({ error: "GoCardless isn't connected yet." }, { status: 503 });
  }

  // `place`: from the calendar's "Add new dog → Send onboarding" — holds a
  // regular Full Day Training place for them, filled in once they register.
  let body: { enquiryId?: string; sendEmail?: boolean; place?: { day?: string; cadence?: string; startOn?: string } };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const enquiryId = String(body.enquiryId ?? "");
  if (!/^[0-9a-f-]{36}$/.test(enquiryId)) return Response.json({ error: "Invalid request." }, { status: 400 });

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

  // Hold their regular place, if one was chosen on the calendar.
  const place = body.place;
  if (place?.day && DAYS.includes(place.day) && /^\d{4}-\d{2}-\d{2}$/.test(place.startOn ?? "")) {
    const cadence = place.cadence === "alternating" ? "alternating" : "weekly";
    const { error: placeError } = await supabase.from("placements").insert({
      day: place.day,
      cadence,
      start_on: place.startOn,
      enquiry_id: e.id,
      account_id: e.account_id,
      holder_name: [e.name, e.dog_names].filter(Boolean).join(" — "),
      created_by: user?.id ?? null,
    });
    if (placeError) return Response.json({ error: "Couldn't hold their place on the calendar." }, { status: 500 });
    await supabase
      .from("enquiries")
      .update({ training_day: place.day, training_cadence: cadence, first_session_on: place.startOn, register_reminders_sent: [] })
      .eq("id", e.id);
  }

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
    await notifyAccount(supabase, e.account_id, {
      title: `🐾 Next steps for ${dogNames || "your dog"}`,
      body: "Set up your Direct Debit and register them before your first session.",
      // The app's Profile tab, where their set-up checklist is.
      path: "/dog",
      kind: "onboarding",
    });
  }

  return Response.json({ ok: true, joinUrl, emailed, messaged });
}
