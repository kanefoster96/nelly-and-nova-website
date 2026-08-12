import { sendEmail } from "@/lib/email/resend";
import { holidayClosureNotice } from "@/lib/email/templates";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Recipient = { email?: string; ownerName?: string };

/**
 * Notify every customer that we're closed for a holiday that week.
 * Resend sends one message at a time, so we fan out over the recipients.
 * TODO(backend): trigger this from the "add holiday" server action (with the
 * real member list) instead of the client, and enqueue the week-before and
 * day-before-session reminders (see lib/holidays/data.ts). Best-effort: missing
 * key or bad addresses never fail the request.
 */
export async function POST(request: Request) {
  let d: { recipients?: Recipient[]; rangeLabel?: string; daysLabel?: string };
  try {
    d = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const rangeLabel = String(d.rangeLabel ?? "").trim();
  const daysLabel = String(d.daysLabel ?? "").trim();
  const recipients = Array.isArray(d.recipients) ? d.recipients : [];

  const valid = recipients.filter(
    (r) => r.email && EMAIL_RE.test(String(r.email).trim())
  );

  const results = await Promise.all(
    valid.map((r) =>
      sendEmail(
        holidayClosureNotice({
          ownerName: String(r.ownerName ?? "").trim(),
          email: String(r.email).trim(),
          rangeLabel,
          daysLabel,
        })
      )
    )
  );

  return Response.json({ ok: true, sent: results.filter(Boolean).length, total: valid.length });
}
