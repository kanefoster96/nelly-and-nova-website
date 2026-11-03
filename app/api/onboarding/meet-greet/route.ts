import { sendEmail } from "@/lib/email/resend";
import { meetGreetBooked } from "@/lib/email/templates";
import { requireTrainer } from "@/lib/records/server";
import { createClient } from "@/lib/supabase/server";
import { notifyAccount } from "@/lib/notifications/send";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Email a customer their meet & greet time, sent from the trainer's
 * Onboarding page after booking one. Trainer-only. Without RESEND_API_KEY it
 * returns sent:false (the booking itself is already saved).
 */
export async function POST(request: Request) {
  const denied = await requireTrainer();
  if (denied) return denied;

  let d: Record<string, string>;
  try {
    d = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = String(d.email ?? "").trim();
  const whenLabel = String(d.whenLabel ?? "").trim();
  if (!EMAIL_RE.test(email) || !whenLabel) {
    return Response.json({ error: "Missing email or time." }, { status: 400 });
  }

  const sent = await sendEmail(
    meetGreetBooked({
      name: String(d.name ?? "").trim(),
      email,
      whenLabel,
      notes: String(d.notes ?? "").trim() || undefined,
    })
  );
  // In the app too, if they have an account with this email.
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (profile?.id) {
    await notifyAccount(supabase, profile.id, {
      title: "📅 Your meet & greet is booked",
      body: `${whenLabel} — we're looking forward to meeting you.`,
      path: "/schedule",
      kind: "meet_greet",
    });
  }
  return Response.json({ ok: true, sent });
}
