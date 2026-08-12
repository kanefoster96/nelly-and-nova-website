import { sendEmail } from "@/lib/email/resend";
import { paymentFailed } from "@/lib/email/templates";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Email a customer that a session payment failed, so they can resubmit.
 * TODO(backend): call this from the GoCardless "payment failed" webhook so it's
 * fully automated; the coach's "resend" button posts here too. Best-effort:
 * missing email (or no RESEND_API_KEY) → ok:true, sent:false.
 */
export async function POST(request: Request) {
  let d: Record<string, string>;
  try {
    d = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = String(d.email ?? "").trim();
  if (!email || !EMAIL_RE.test(email)) {
    return Response.json({ ok: true, sent: false });
  }

  const sent = await sendEmail(
    paymentFailed({
      ownerName: String(d.ownerName ?? "").trim(),
      email,
      dogName: String(d.dogName ?? "").trim(),
      dateLabel: String(d.dateLabel ?? "").trim(),
      retryUrl: String(d.retryUrl ?? "").trim() || undefined,
    })
  );

  return Response.json({ ok: true, sent });
}
