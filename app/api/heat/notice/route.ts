import { sendEmail } from "@/lib/email/resend";
import { heatDayNotice } from "@/lib/email/templates";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Recipient = { email?: string; ownerName?: string };

/**
 * Notify everyone with a session on a heat day that collection/drop-off move
 * earlier. Best-effort: a missing key or bad address never fails the request.
 * TODO(backend): trigger from the "mark heat day" server action with the real
 * per-date roster instead of the client.
 */
export async function POST(request: Request) {
  let d: {
    recipients?: Recipient[];
    dateLabel?: string;
    collectionLabel?: string;
    dropoffLabel?: string;
  };
  try {
    d = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const dateLabel = String(d.dateLabel ?? "").trim();
  const collectionLabel = String(d.collectionLabel ?? "").trim();
  const dropoffLabel = String(d.dropoffLabel ?? "").trim();
  const recipients = Array.isArray(d.recipients) ? d.recipients : [];

  const valid = recipients.filter((r) => r.email && EMAIL_RE.test(String(r.email).trim()));

  const results = await Promise.all(
    valid.map((r) =>
      sendEmail(
        heatDayNotice({
          ownerName: String(r.ownerName ?? "").trim(),
          email: String(r.email).trim(),
          dateLabel,
          collectionLabel,
          dropoffLabel,
        })
      )
    )
  );

  return Response.json({ ok: true, sent: results.filter(Boolean).length, total: valid.length });
}
