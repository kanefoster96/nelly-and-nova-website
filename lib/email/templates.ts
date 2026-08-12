/**
 * Transactional email templates (server-only). Each returns { subject, html,
 * text }. Keep copy here so it's easy to tweak. Values are pre-formatted by the
 * caller (no date libraries in templates).
 */
import { site } from "@/config/site";
import type { EmailMessage } from "./resend";

const BRAND = site.name;
const ACCENT = "#c8a24a"; // warm gold — close to the site accent

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string
  );
}

/** Branded HTML shell. `bodyHtml` is trusted (built from escaped values). */
function layout(heading: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#0f0f10;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#17171a;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:28px 28px 8px;">
        <p style="margin:0;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:${ACCENT};font-weight:700;">${escape(BRAND)}</p>
        <h1 style="margin:8px 0 0;font-size:24px;line-height:1.2;color:#f5f3ee;">${escape(heading)}</h1>
      </td></tr>
      <tr><td style="padding:12px 28px 28px;color:#cfccc4;font-size:15px;line-height:1.6;">
        ${bodyHtml}
      </td></tr>
      <tr><td style="padding:18px 28px;border-top:1px solid rgba(255,255,255,.08);color:#8a8880;font-size:12px;">
        ${escape(BRAND)} · Dog training in Tynemouth, Backworth &amp; local areas
      </td></tr>
    </table>
  </body></html>`;
}

// --- Customer: booking request received -----------------------------------

export function bookingConfirmation(d: {
  firstName: string;
  email: string;
  dogName: string;
  serviceLabel?: string;
}): EmailMessage {
  const name = d.firstName || "there";
  const svc = d.serviceLabel ? ` for ${d.serviceLabel}` : "";
  const html = layout("We've got your request", `
    <p>Hi ${escape(name)},</p>
    <p>Thanks for your booking request${escape(svc)} with ${escape(d.dogName || "your dog")}. We've received it and we'll be in touch shortly to arrange your free meet &amp; greet.</p>
    <p>There's nothing more you need to do for now — we'll email you the next steps.</p>
    <p style="margin-top:20px;">Speak soon,<br/>The ${escape(BRAND)} team</p>
  `);
  const text = [
    `Hi ${name},`,
    "",
    `Thanks for your booking request${svc} with ${d.dogName || "your dog"}. We've received it and we'll be in touch shortly to arrange your free meet & greet.`,
    "",
    "There's nothing more you need to do for now — we'll email you the next steps.",
    "",
    `Speak soon, The ${BRAND} team`,
  ].join("\n");
  return { to: d.email, subject: `We've got your request — ${BRAND}`, html, text, replyTo: undefined };
}

// --- Team: new booking request --------------------------------------------

export function bookingOwnerNotification(d: {
  firstName: string;
  lastName: string;
  email: string;
  serviceLabel?: string;
  detailsText: string;
  to: string;
}): EmailMessage {
  const who = `${d.firstName} ${d.lastName}`.trim();
  const html = layout("New booking request", `
    <p>${escape(who)} sent a meet &amp; greet request${d.serviceLabel ? ` for ${escape(d.serviceLabel)}` : ""}.</p>
    <pre style="white-space:pre-wrap;font-family:inherit;background:#111;padding:14px;border-radius:10px;color:#cfccc4;">${escape(d.detailsText)}</pre>
  `);
  return {
    to: d.to,
    subject: `New booking request — ${who} (${d.serviceLabel ?? "enquiry"})`,
    html,
    text: d.detailsText,
    replyTo: d.email,
  };
}

// --- Customer: session payment failed (please resubmit) --------------------

export function paymentFailed(d: {
  ownerName: string;
  email: string;
  dogName: string;
  dateLabel: string; // e.g. "Thursday 21 August"
  retryUrl?: string; // GoCardless resubmit link
}): EmailMessage {
  const name = (d.ownerName || "there").split(" ")[0];
  const cta = d.retryUrl
    ? `<p style="margin:18px 0;"><a href="${escape(d.retryUrl)}" style="display:inline-block;background:${ACCENT};color:#1b1b1b;text-decoration:none;font-weight:600;padding:11px 20px;border-radius:999px;">Resubmit payment</a></p>`
    : `<p style="margin:18px 0;">Please reply to this email and we'll send you a secure link to resubmit.</p>`;
  const html = layout("Your payment didn't go through", `
    <p>Hi ${escape(name)},</p>
    <p>The payment for ${escape(d.dogName || "your dog")}'s session on <strong>${escape(d.dateLabel)}</strong> didn't go through. This is usually a temporary issue with the bank.</p>
    ${cta}
    <p>Your session is safe for now — resubmitting keeps everything on track. Any questions, just reply.</p>
    <p style="margin-top:20px;">Thanks,<br/>The ${escape(BRAND)} team</p>
  `);
  const text = [
    `Hi ${name},`,
    "",
    `The payment for ${d.dogName || "your dog"}'s session on ${d.dateLabel} didn't go through. This is usually a temporary bank issue.`,
    "",
    d.retryUrl ? `Resubmit payment: ${d.retryUrl}` : "Reply to this email and we'll send a secure link to resubmit.",
    "",
    "Your session is safe for now — resubmitting keeps everything on track.",
    "",
    `Thanks, The ${BRAND} team`,
  ].join("\n");
  return { to: d.email, subject: `Action needed: payment for ${d.dogName || "your dog"}'s session — ${BRAND}`, html, text };
}

// --- Customer: placement confirmed (day + first start date) ----------------

export function placementConfirmed(d: {
  ownerName: string;
  email: string;
  dogName: string;
  dayLabel: string; // e.g. "Thursdays"
  cadenceLabel?: string; // e.g. "every week" / "alternating weeks"
  startDateLabel: string; // e.g. "Thursday 21 August 2026"
}): EmailMessage {
  const name = (d.ownerName || "there").split(" ")[0];
  const cadence = d.cadenceLabel ? ` (${d.cadenceLabel})` : "";
  const html = layout("You're all booked in", `
    <p>Hi ${escape(name)},</p>
    <p>Great news — ${escape(d.dogName || "your dog")}'s place is confirmed. Here are the details:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0;">
      <tr><td style="padding:6px 0;color:#8a8880;">Training day</td><td style="padding:6px 0 6px 16px;color:#f5f3ee;font-weight:600;">${escape(d.dayLabel)}${escape(cadence)}</td></tr>
      <tr><td style="padding:6px 0;color:#8a8880;">First session</td><td style="padding:6px 0 6px 16px;color:#f5f3ee;font-weight:600;">${escape(d.startDateLabel)}</td></tr>
    </table>
    <p>We can't wait to get started. If anything changes before then, just reply to this email.</p>
    <p style="margin-top:20px;">See you soon,<br/>The ${escape(BRAND)} team</p>
  `);
  const text = [
    `Hi ${name},`,
    "",
    `Great news — ${d.dogName || "your dog"}'s place is confirmed.`,
    "",
    `Training day: ${d.dayLabel}${cadence}`,
    `First session: ${d.startDateLabel}`,
    "",
    "We can't wait to get started. If anything changes before then, just reply to this email.",
    "",
    `See you soon, The ${BRAND} team`,
  ].join("\n");
  return { to: d.email, subject: `You're all booked in — ${BRAND}`, html, text };
}
