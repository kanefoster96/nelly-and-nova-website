/**
 * Resend email sender (server-only).
 * ----------------------------------
 * One place to send transactional email. Best-effort: if RESEND_API_KEY isn't
 * set, sends are skipped (logged) and never throw, so a missing key never
 * breaks a request. Set the keys in the environment — see .env.example.
 */
import { site, contact } from "@/config/site";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export function fromAddress(): string {
  return process.env.CONTACT_FROM_EMAIL || `${site.name} <onboarding@resend.dev>`;
}

/** Where team-facing notifications go. */
export function ownerAddress(): string {
  return process.env.CONTACT_TO_EMAIL || contact.email;
}

/** Send one email. Returns true if accepted by Resend, false otherwise. */
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email] skipped "${msg.subject}" → ${msg.to} (no RESEND_API_KEY)`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [msg.to],
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
    if (!res.ok) {
      console.error("[email] Resend error", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] send failed", err);
    return false;
  }
}
