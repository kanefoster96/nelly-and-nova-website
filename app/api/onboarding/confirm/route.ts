import { sendEmail } from "@/lib/email/resend";
import { placementConfirmed } from "@/lib/email/templates";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Send a customer their "you're all booked in" email when a coach confirms a
 * placement — training day + first start date. Best-effort: no email address
 * (or no RESEND_API_KEY) → ok:true, sent:false, never an error.
 * TODO(backend): trigger this server-side from confirmPlacement instead of the
 * client, so it can't be spoofed.
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
    // Nothing to send to — not an error (sample slots may have no email yet).
    return Response.json({ ok: true, sent: false });
  }

  const sent = await sendEmail(
    placementConfirmed({
      ownerName: String(d.ownerName ?? "").trim(),
      email,
      dogName: String(d.dogName ?? "").trim(),
      dayLabel: String(d.dayLabel ?? "").trim(),
      cadenceLabel: String(d.cadenceLabel ?? "").trim() || undefined,
      startDateLabel: String(d.startDateLabel ?? "").trim(),
      chargeDayLabel: String(d.chargeDayLabel ?? "").trim() || undefined,
    })
  );

  return Response.json({ ok: true, sent });
}
