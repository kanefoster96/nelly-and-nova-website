/**
 * Transactional email templates (server-only). Each returns { subject, html,
 * text }. Keep copy here so it's easy to tweak. Values are pre-formatted by the
 * caller (no date libraries in templates).
 */
import { site } from "@/config/site";
import type { EmailMessage } from "./resend";
import { requestNextSteps } from "@/config/booking";

const BRAND = site.name;

/**
 * Where the logo image is loaded from. Emails can't embed SVG, so this points
 * at the PNG in public/brand/. Set NEXT_PUBLIC_SITE_URL to the live domain
 * (e.g. https://www.nellyandnova.co.uk) once it's connected.
 */
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://nelly-and-nova-website.vercel.app").replace(/\/$/, "");
const LOGO_URL = `${SITE_URL}/brand/nn-logo-white.png`;
const ACCENT = "#ffffff"; // black & white brand: buttons are white with black text

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string
  );
}

/** Branded HTML shell. `bodyHtml` is trusted (built from escaped values). */
function layout(heading: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#000000;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#0a0a0a;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:28px 28px 8px;">
        <img src="${LOGO_URL}" width="66" height="40" alt="${escape(BRAND)}" style="display:block;width:66px;height:40px;border:0;color:#ffffff;font-size:14px;font-weight:700;letter-spacing:.15em;" />
        <h1 style="margin:18px 0 0;font-size:24px;line-height:1.2;color:#ffffff;">${escape(heading)}</h1>
      </td></tr>
      <tr><td style="padding:12px 28px 28px;color:#d4d4d4;font-size:15px;line-height:1.6;">
        ${bodyHtml}
      </td></tr>
      <tr><td style="padding:18px 28px;border-top:1px solid rgba(255,255,255,.08);color:#8c8c8c;font-size:12px;">
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
  /** Service key (full-day-training, one-to-one, online-training, not-sure). */
  service?: string;
  serviceLabel?: string;
}): EmailMessage {
  const name = d.firstName || "there";
  const dog = d.dogName || "your dog";
  const next = requestNextSteps(d.service ?? "", dog);
  const html = layout("We'll be in touch", `
    <p>Hi ${escape(name)},</p>
    <p>Thanks for getting in touch about ${escape(dog)}${d.serviceLabel && d.serviceLabel !== "Not sure yet" ? ` and ${escape(d.serviceLabel)}` : ""}. We've got everything you sent us.</p>
    <p>${escape(next.body)}</p>
    <p>There's nothing else you need to do for now. Usually we're back in touch within a day or two.</p>
    <p style="margin-top:20px;">Speak soon,<br/>The ${escape(BRAND)} team</p>
  `);
  const text = [
    `Hi ${name},`,
    "",
    `Thanks for getting in touch about ${dog}. We've got everything you sent us.`,
    "",
    next.body,
    "",
    "There's nothing else you need to do for now. Usually we're back in touch within a day or two.",
    "",
    `Speak soon, The ${BRAND} team`,
  ].join("\n");
  return { to: d.email, subject: `We'll be in touch — ${BRAND}`, html, text, replyTo: undefined };
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
  const html = layout("New request", `
    <p>${escape(who)} sent a request${d.serviceLabel ? ` for ${escape(d.serviceLabel)}` : ""}. It's in your Onboarding list.</p>
    <pre style="white-space:pre-wrap;font-family:inherit;background:#1a1a1a;padding:14px;border-radius:10px;color:#d4d4d4;">${escape(d.detailsText)}</pre>
  `);
  return {
    to: d.to,
    subject: `New request — ${who} (${d.serviceLabel ?? "enquiry"})`,
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
    ? `<p style="margin:18px 0;"><a href="${escape(d.retryUrl)}" style="display:inline-block;background:${ACCENT};color:#000000;text-decoration:none;font-weight:600;padding:11px 20px;border-radius:999px;">Resubmit payment</a></p>`
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
  chargeDayLabel?: string; // weekday charges land on — day before the session
}): EmailMessage {
  const name = (d.ownerName || "there").split(" ")[0];
  const cadence = d.cadenceLabel ? ` (${d.cadenceLabel})` : "";
  const paymentLine = d.chargeDayLabel
    ? `${d.chargeDayLabel}s${cadence} — the day before each session`
    : "";
  const paymentRow = paymentLine
    ? `<tr><td style="padding:6px 0;color:#8c8c8c;">Payment</td><td style="padding:6px 0 6px 16px;color:#ffffff;font-weight:600;">${escape(paymentLine)}</td></tr>`
    : "";
  const html = layout("You're all booked in", `
    <p>Hi ${escape(name)},</p>
    <p>Great news — ${escape(d.dogName || "your dog")}'s place is confirmed. Here are the details:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0;">
      <tr><td style="padding:6px 0;color:#8c8c8c;">Training day</td><td style="padding:6px 0 6px 16px;color:#ffffff;font-weight:600;">${escape(d.dayLabel)}${escape(cadence)}</td></tr>
      <tr><td style="padding:6px 0;color:#8c8c8c;">First session</td><td style="padding:6px 0 6px 16px;color:#ffffff;font-weight:600;">${escape(d.startDateLabel)}</td></tr>
      ${paymentRow}
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
    ...(paymentLine ? [`Payment: ${paymentLine}`] : []),
    "",
    "We can't wait to get started. If anything changes before then, just reply to this email.",
    "",
    `See you soon, The ${BRAND} team`,
  ].join("\n");
  return { to: d.email, subject: `You're all booked in — ${BRAND}`, html, text };
}

// --- Customer: holiday closure notice (sent to everyone when a holiday is set)

export function holidayClosureNotice(d: {
  ownerName?: string;
  email: string;
  rangeLabel: string; // e.g. "2–9 March 2026"
  daysLabel: string; // e.g. "8 days"
}): EmailMessage {
  const name = (d.ownerName || "there").split(" ")[0];
  const html = layout("We're closed for a short break", `
    <p>Hi ${escape(name)},</p>
    <p>A quick heads-up: ${escape(BRAND)} will be closed for <strong>${escape(d.rangeLabel)}</strong> (${escape(d.daysLabel)}). There won't be any sessions or collections that week.</p>
    <p>Your weekly place is safe and picks up as normal afterwards. As a member this counts as one of the four holiday weeks included in your membership, so there's nothing to pay or reschedule.</p>
    <p>We'll send a reminder the week before, and again the day before your session. Any questions, just reply.</p>
    <p style="margin-top:20px;">Thanks,<br/>The ${escape(BRAND)} team</p>
  `);
  const text = [
    `Hi ${name},`,
    "",
    `A quick heads-up: ${BRAND} will be closed for ${d.rangeLabel} (${d.daysLabel}). There won't be any sessions or collections that week.`,
    "",
    "Your weekly place is safe and picks up as normal afterwards. As a member this counts as one of the four holiday weeks included in your membership, so there's nothing to pay or reschedule.",
    "",
    "We'll send a reminder the week before, and again the day before your session.",
    "",
    `Thanks, The ${BRAND} team`,
  ].join("\n");
  return { to: d.email, subject: `We're closed ${d.rangeLabel} — ${BRAND}`, html, text };
}

// --- Customer: reminder one week before a closure --------------------------

export function holidayWeekBeforeReminder(d: {
  ownerName?: string;
  email: string;
  rangeLabel: string;
}): EmailMessage {
  const name = (d.ownerName || "there").split(" ")[0];
  const html = layout("One week to go — we're closed soon", `
    <p>Hi ${escape(name)},</p>
    <p>Just a reminder that ${escape(BRAND)} is closed from next week — <strong>${escape(d.rangeLabel)}</strong>. No sessions or collections will run during that time.</p>
    <p>Everything resumes as normal the following week. See you then!</p>
    <p style="margin-top:20px;">Thanks,<br/>The ${escape(BRAND)} team</p>
  `);
  const text = [
    `Hi ${name},`,
    "",
    `Just a reminder that ${BRAND} is closed from next week — ${d.rangeLabel}. No sessions or collections will run during that time.`,
    "",
    "Everything resumes as normal the following week. See you then!",
    "",
    `Thanks, The ${BRAND} team`,
  ].join("\n");
  return { to: d.email, subject: `Reminder: we're closed ${d.rangeLabel} — ${BRAND}`, html, text };
}

// --- Customer: day-before reminder that this session isn't on --------------

export function holidaySessionSkipped(d: {
  ownerName?: string;
  email: string;
  dogName: string;
  dateLabel: string; // e.g. "Thursday 5 March"
}): EmailMessage {
  const name = (d.ownerName || "there").split(" ")[0];
  const html = layout("No session tomorrow — we're closed", `
    <p>Hi ${escape(name)},</p>
    <p>A reminder that ${escape(d.dogName || "your dog")}'s usual session on <strong>${escape(d.dateLabel)}</strong> <strong>isn't on</strong> — we're closed for our holiday this week.</p>
    <p>Your place is safe and your normal session returns next week. Enjoy the week off!</p>
    <p style="margin-top:20px;">Thanks,<br/>The ${escape(BRAND)} team</p>
  `);
  const text = [
    `Hi ${name},`,
    "",
    `A reminder that ${d.dogName || "your dog"}'s usual session on ${d.dateLabel} isn't on — we're closed for our holiday this week.`,
    "",
    "Your place is safe and your normal session returns next week. Enjoy the week off!",
    "",
    `Thanks, The ${BRAND} team`,
  ].join("\n");
  return { to: d.email, subject: `No session ${d.dateLabel} — we're closed — ${BRAND}`, html, text };
}

// --- Customer: severe heat day — earlier collection / drop-off -------------

export function heatDayNotice(d: {
  ownerName?: string;
  email: string;
  dateLabel: string; // e.g. "Thursday 5 March"
  collectionLabel: string; // e.g. "Collection from 6:00am"
  dropoffLabel: string; // e.g. "Drop-off from 2:00pm"
}): EmailMessage {
  const name = (d.ownerName || "there").split(" ")[0];
  const html = layout("Hot day — earlier collection & drop-off", `
    <p>Hi ${escape(name)},</p>
    <p><strong>${escape(d.dateLabel)}</strong> is forecast to be very hot, so to keep the dogs safe we're walking early and avoiding the midday heat.</p>
    <p>For that day only, the times change:</p>
    <p style="margin:8px 0;"><strong>${escape(d.collectionLabel)}</strong><br/><strong>${escape(d.dropoffLabel)}</strong></p>
    <p>Everything else stays the same, and normal times resume at your next session. Any questions, just reply.</p>
    <p style="margin-top:20px;">Thanks,<br/>The ${escape(BRAND)} team</p>
  `);
  const text = [
    `Hi ${name},`,
    "",
    `${d.dateLabel} is forecast to be very hot, so to keep the dogs safe we're walking early and avoiding the midday heat.`,
    "",
    `For that day only, the times change:`,
    `${d.collectionLabel}`,
    `${d.dropoffLabel}`,
    "",
    "Normal times resume at your next session.",
    "",
    `Thanks, The ${BRAND} team`,
  ].join("\n");
  return { to: d.email, subject: `Hot day ${d.dateLabel} — earlier times — ${BRAND}`, html, text };
}

// --- Customer: meet & greet booked ----------------------------------------

export function meetGreetBooked(d: {
  name: string;
  email: string;
  whenLabel: string; // e.g. "Thursday 2 October at 10:30"
  notes?: string;
}): EmailMessage {
  const first = d.name.split(" ")[0] || "there";
  const html = layout("Your meet & greet is booked", `
    <p>Hi ${escape(first)},</p>
    <p>Lovely to hear from you. We've booked your free meet &amp; greet for <b style="color:#ffffff;">${escape(d.whenLabel)}</b>.</p>
    ${d.notes ? `<p>${escape(d.notes).replace(/\n/g, "<br/>")}</p>` : ""}
    <p>Need to change the time? Just reply to this email.</p>
    <p style="margin-top:20px;">See you soon,<br/>The ${escape(BRAND)} team</p>
  `);
  const text = [
    `Hi ${first},`,
    "",
    `We've booked your free meet & greet for ${d.whenLabel}.`,
    ...(d.notes ? ["", d.notes] : []),
    "",
    "Need to change the time? Just reply to this email.",
    "",
    `See you soon, The ${BRAND} team`,
  ].join("\n");
  return { to: d.email, subject: `Your meet & greet with ${BRAND}`, html, text };
}

// --- Customer: onboarding started (after the meet & greet) -----------------

export function onboardingStarted(d: {
  name: string;
  email: string;
  dogNames: string;
  joinUrl: string;
}): EmailMessage {
  const first = d.name.split(" ")[0] || "there";
  const dog = d.dogNames || "your dog";
  const html = layout("Let's get you set up", `
    <p>Hi ${escape(first)},</p>
    <p>It was lovely meeting ${escape(dog)} — we're really looking forward to working together!</p>
    <p>There are three quick things to do before your first session, all from one page:</p>
    <ol style="padding-left:20px;margin:12px 0;">
      <li style="margin:6px 0;"><b style="color:#ffffff;">Set up your Direct Debit</b> with GoCardless (it's their secure page — we never see your bank details)</li>
      <li style="margin:6px 0;"><b style="color:#ffffff;">Create your account</b>, if you haven't already</li>
      <li style="margin:6px 0;"><b style="color:#ffffff;">Register ${escape(dog)}</b> — their health and vet details, and the consent &amp; waiver</li>
    </ol>
    <p><a href="${escape(d.joinUrl)}" style="display:inline-block;background:${ACCENT};color:#000000;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600;">Get started</a></p>
    <p>We'll confirm your training day with you directly. Any questions, just reply to this email.</p>
    <p style="margin-top:20px;">See you soon,<br/>The ${escape(BRAND)} team</p>
  `);
  const text = [
    `Hi ${first},`,
    "",
    `It was lovely meeting ${dog} — we're really looking forward to working together!`,
    "",
    "Three quick things to do before your first session, all from one page:",
    "1. Set up your Direct Debit with GoCardless (their secure page — we never see your bank details)",
    "2. Create your account, if you haven't already",
    `3. Register ${dog} — their health and vet details, and the consent & waiver`,
    "",
    `Get started: ${d.joinUrl}`,
    "",
    "We'll confirm your training day with you directly. Any questions, just reply to this email.",
    "",
    `See you soon, The ${BRAND} team`,
  ].join("\n");
  return { to: d.email, subject: `Next steps for ${dog} — ${BRAND}`, html, text };
}

// --- App log in: set up account / reset password ---------------------------

export function appSetupLink(d: { email: string; url: string; isNew: boolean }): EmailMessage {
  const button = d.isNew ? "Set Up My Account" : "Reset My Password";
  const html = layout(d.isNew ? "Set up your account" : "Reset your password", `
    <p>${d.isNew ? "Tap below on your phone to choose a password and set up your Nelly &amp; Nova account." : "Tap below on your phone to choose a new password."}</p>
    <p><a href="${escape(d.url)}" style="display:inline-block;background:${ACCENT};color:#000000;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600;">${button}</a></p>
    <p style="color:#8c8c8c;font-size:13px;">This button works for an hour. Didn't ask for it? You can ignore this email.</p>
  `);
  const text = [
    d.isNew ? "Set up your Nelly & Nova account:" : "Reset your Nelly & Nova password:",
    d.url,
    "",
    "This link works for an hour. Didn't ask for it? You can ignore this email.",
  ].join("\n");
  return { to: d.email, subject: d.isNew ? `Set up your ${BRAND} account` : `Reset your ${BRAND} password`, html, text };
}

// --- Customer: register your dog before the first session -------------------

export function registerReminder(d: {
  name: string;
  email: string;
  dogNames: string;
  firstSessionLabel: string; // "Thursday 13 November"
  daysToGo: number;
  joinUrl: string;
}): EmailMessage {
  const first = d.name.split(" ")[0] || "there";
  const dog = d.dogNames || "your dog";
  const when = d.daysToGo <= 0 ? "today" : d.daysToGo === 1 ? "tomorrow" : `on ${d.firstSessionLabel}`;
  const html = layout(`Register ${dog} before ${d.daysToGo <= 1 ? "tomorrow" : "their first session"}`, `
    <p>Hi ${escape(first)},</p>
    <p>${escape(dog)}'s first session is ${escape(when)} — we can't wait! Before we can collect them, we need them registered: their health and vet details, emergency contacts, and the consent &amp; waiver.</p>
    <p>It only takes a few minutes:</p>
    <p><a href="${escape(d.joinUrl)}" style="display:inline-block;background:${ACCENT};color:#000000;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600;">Register ${escape(dog)}</a></p>
    <p>If it isn't done before the session, we won't be able to pick ${escape(dog)} up. Any questions, just reply to this email.</p>
    <p style="margin-top:20px;">See you soon,<br/>The ${escape(BRAND)} team</p>
  `);
  const text = [
    `Hi ${first},`,
    "",
    `${dog}'s first session is ${when} — we can't wait! Before we can collect them, we need them registered: their health and vet details, emergency contacts, and the consent & waiver.`,
    "",
    `Register ${dog}: ${d.joinUrl}`,
    "",
    `If it isn't done before the session, we won't be able to pick ${dog} up. Any questions, just reply to this email.`,
    "",
    `See you soon, The ${BRAND} team`,
  ].join("\n");
  return { to: d.email, subject: `Register ${dog} before ${d.daysToGo <= 1 ? "tomorrow" : "their first session"} — ${BRAND}`, html, text };
}

// --- Customer: a new report card after a session ----------------------------

export function reportCardPublished(d: {
  name: string;
  email: string;
  dogName: string;
  title: string; // "Recall · Settle"
  summary: string;
  dateLabel: string; // "Tuesday 4 November"
  homeworkCount: number;
  url: string; // the website's report cards page
}): EmailMessage {
  const first = d.name.split(" ")[0] || "there";
  const dog = d.dogName || "your dog";
  const homework =
    d.homeworkCount > 0
      ? `There ${d.homeworkCount === 1 ? "is 1 drill" : `are ${d.homeworkCount} drills`} to practise. Do them on 3 separate days in the next 2 weeks and tap “I practised today” each time.`
      : "";
  const html = layout(`${dog}'s report card is ready`, `
    <p>Hi ${escape(first)},</p>
    <p>Here's how ${escape(dog)} got on at ${escape(d.dateLabel)}'s session${d.title ? `: <strong style="color:#ffffff;">${escape(d.title)}</strong>` : ""}.</p>
    ${d.summary ? `<p style="border-left:2px solid rgba(255,255,255,.2);padding-left:12px;color:#bdbdbd;">${escape(d.summary)}</p>` : ""}
    ${homework ? `<p>${escape(homework)}</p>` : ""}
    <p><a href="${escape(d.url)}" style="display:inline-block;background:${ACCENT};color:#000000;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600;">See the report card</a></p>
    <p>It's in the app under Homework too. Any questions, ask on the card or just reply to this email.</p>
    <p style="margin-top:20px;">Thanks,<br/>The ${escape(BRAND)} team</p>
  `);
  const text = [
    `Hi ${first},`,
    "",
    `Here's how ${dog} got on at ${d.dateLabel}'s session${d.title ? `: ${d.title}` : ""}.`,
    ...(d.summary ? ["", d.summary] : []),
    ...(homework ? ["", homework] : []),
    "",
    `See the report card: ${d.url}`,
    "",
    "It's in the app under Homework too. Any questions, ask on the card or just reply to this email.",
    "",
    `Thanks, The ${BRAND} team`,
  ].join("\n");
  return { to: d.email, subject: `${dog}'s report card is ready — ${BRAND}`, html, text };
}
