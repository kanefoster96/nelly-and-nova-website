import { NextResponse } from "next/server";
import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { accountIdForEmail, overRateLimit, passwordProblem, recordRequest, requestIp, spendTicket } from "@/lib/auth/app-login";

/**
 * Sets the password once the emailed button has proved the inbox (its
 * one-use ticket), then the app signs in with it.
 *  - Has an account: a forgotten password. Replaced, and the email is
 *    marked confirmed (the inbox has just been proved).
 *  - No account: someone who asked for a meet & greet. The account is made
 *    here, confirmed, with their name; their request links itself to it by
 *    email (database trigger), so it shows in the app straight away.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  const email = text(body?.email).trim();
  const ticket = text(body?.ticket).trim();
  const password = text(body?.password);
  const name = text(body?.name).replace(/\s+/g, " ").trim().slice(0, 80);
  if (!email || !ticket) return NextResponse.json({ error: "Something went wrong. Go back, send a new email and try again." }, { status: 400 });
  const problem = passwordProblem(password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  if (!adminConfigured()) return NextResponse.json({ error: "Something went wrong. Please try again later." }, { status: 503 });

  const admin = createAdminClient();
  const ip = requestIp(request);
  if (await overRateLimit(admin, "auth_set_password", { ip, perIp: 20 })) {
    return NextResponse.json({ error: "Too many tries. Please wait a while and try again." }, { status: 429 });
  }

  const account = await accountIdForEmail(admin, email);
  if (account === "unknown") return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  if (!account && !name) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });

  await recordRequest(admin, "auth_set_password", ip, email);
  if (!(await spendTicket(admin, email, ticket))) {
    return NextResponse.json({ error: "That link has expired or been used. Go back, send a new email and try again." }, { status: 400 });
  }

  if (account) {
    const { error } = await admin.auth.admin.updateUserById(account, { password, email_confirm: true });
    if (error) {
      console.error("set-password: update failed", error);
      return NextResponse.json({ error: "We couldn't save that password. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { owner_name: name },
  });
  if (error) {
    console.error("set-password: createUser failed", error);
    return NextResponse.json({ error: "We couldn't set up your account. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
