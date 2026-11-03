import { NextResponse } from "next/server";
import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";
import {
  EMAIL_RE,
  accountIdForEmail,
  issueTicket,
  overRateLimit,
  recordRequest,
  requestIp,
  resendWaitSeconds,
} from "@/lib/auth/app-login";
import { sendEmail } from "@/lib/email/resend";
import { appSetupLink } from "@/lib/email/templates";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Emails a "Set up my account" (no account yet) or "Reset my password"
 * button. Tapped on the phone it opens the app straight on "Create a
 * password" (/app-setup is an app link), carrying a one-use ticket, so
 * nothing is typed but the password. Opening the link uses nothing up: the
 * ticket is spent when the password is saved, so a mail scanner opening it
 * is harmless. Whoever reads that inbox owns the address — that's the proof.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  if (!adminConfigured()) return NextResponse.json({ error: "We couldn't send the email just now. Please try again later." }, { status: 503 });

  const admin = createAdminClient();
  const ip = requestIp(request);
  if (
    (await overRateLimit(admin, "auth_send_link", { ip, perIp: 10, email, perEmail: 5 })) ||
    (await overRateLimit(admin, "auth_send_link", { email, perEmail: 8 }, DAY_MS))
  ) {
    return NextResponse.json({ error: "That's a lot of emails in a short time. Please wait a while and try again." }, { status: 429 });
  }
  const wait = await resendWaitSeconds(admin, email);
  if (wait > 0) {
    return NextResponse.json(
      { error: `Please wait ${wait} second${wait === 1 ? "" : "s"} before asking for another email.`, retryAfter: wait },
      { status: 429 }
    );
  }
  await recordRequest(admin, "auth_send_link", ip, email);

  const ticket = await issueTicket(admin, email);
  if (!ticket) return NextResponse.json({ error: "We couldn't send the email just now. Please try again in a minute." }, { status: 500 });
  const account = await accountIdForEmail(admin, email);
  const isNew = account === null;
  // Ask for a name unless we know they already have an account.
  const askName = account === null || account === "unknown";

  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(request.url).origin;
  const url = `${origin}/app-setup?${new URLSearchParams({ e: email, t: ticket, a: askName ? "0" : "1" })}`;
  const sent = await sendEmail(appSetupLink({ email, url, isNew }));
  if (!sent) return NextResponse.json({ error: "We couldn't send the email just now. Please try again in a minute." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
