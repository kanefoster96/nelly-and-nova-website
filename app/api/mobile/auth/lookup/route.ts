import { NextResponse } from "next/server";
import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { EMAIL_RE, accountIdForEmail, hasOpenRequest, overRateLimit, recordRequest, requestIp } from "@/lib/auth/app-login";

/**
 * The app's log in, step one (like Kanvas Academy's): the owner types their
 * email and this says which screen comes next.
 *   account: true  → ask for their password
 *   known: true    → no account yet, but they've asked for a meet & greet →
 *                    email them a "Set up my account" button
 *   neither        → "No account yet" → ask for a free meet & greet
 * It does tell whoever types an address whether it has an account (the
 * trade every email-first log in makes); the per-IP limit stops anyone
 * running a list of addresses through it.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  if (!adminConfigured()) return NextResponse.json({ ok: true, account: true, known: false }); // falls back to the password screen

  const admin = createAdminClient();
  const ip = requestIp(request);
  if (await overRateLimit(admin, "auth_lookup", { ip, perIp: 30 })) {
    return NextResponse.json({ error: "Too many tries. Please wait a while and try again." }, { status: 429 });
  }
  await recordRequest(admin, "auth_lookup", ip, email);

  const account = await accountIdForEmail(admin, email);
  // A failed lookup goes to the password screen: anyone with an account can
  // carry on, and anyone without one is told so when it doesn't match.
  if (account === "unknown") return NextResponse.json({ ok: true, account: true, known: false });
  const known = account === null ? await hasOpenRequest(admin, email) : false;
  return NextResponse.json({ ok: true, account: account !== null, known });
}
