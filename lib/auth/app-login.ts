import crypto from "node:crypto";
import type { Admin } from "@/lib/supabase/admin";

/**
 * Helpers for the app's email-first log in (ported from Kanvas Academy's
 * lib/email-codes.ts and lib/app-rate-limit.ts):
 *  - one-use tickets, emailed in a "Set up my account" / "Reset my
 *    password" button; only a hash is kept, an hour, one use;
 *  - simple per-IP / per-email limits in public.app_request_log;
 *  - account lookups by email.
 */

export const LINK_MINUTES = 60;
export const RESEND_COOLDOWN_SECONDS = 60;
const WINDOW_MS = 60 * 60 * 1000;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hash(email: string, secret: string): string {
  return crypto.createHash("sha256").update(`ticket:${normaliseEmail(email)}:${secret}`).digest("hex");
}

export async function issueTicket(admin: Admin, email: string): Promise<string | null> {
  const ticket = crypto.randomBytes(24).toString("base64url");
  const { error } = await admin.from("email_codes").upsert(
    {
      email: normaliseEmail(email),
      purpose: "ticket",
      code_hash: hash(email, ticket),
      expires_at: new Date(Date.now() + LINK_MINUTES * 60 * 1000).toISOString(),
      attempts: 0,
      sent_at: new Date().toISOString(),
    },
    { onConflict: "email,purpose" }
  );
  if (error) console.error("app-login: saving ticket failed", error);
  return error ? null : ticket;
}

/** Seconds until another email may go to this address (0 = now). */
export async function resendWaitSeconds(admin: Admin, email: string): Promise<number> {
  const { data } = await admin.from("email_codes").select("sent_at").eq("email", normaliseEmail(email)).eq("purpose", "ticket").maybeSingle();
  if (!data?.sent_at) return 0;
  const elapsed = (Date.now() - new Date(data.sent_at as string).getTime()) / 1000;
  return Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed));
}

/** Uses up a ticket: true if it was right and in date. Five wrong tries and it's done. */
export async function spendTicket(admin: Admin, email: string, ticket: string): Promise<boolean> {
  const address = normaliseEmail(email);
  const { data: row } = await admin
    .from("email_codes")
    .select("code_hash, expires_at, attempts")
    .eq("email", address)
    .eq("purpose", "ticket")
    .maybeSingle();
  if (!row || new Date(row.expires_at as string).getTime() <= Date.now() || (row.attempts as number) >= 5) return false;
  await admin.from("email_codes").update({ attempts: (row.attempts as number) + 1 }).eq("email", address).eq("purpose", "ticket");
  const expected = Buffer.from(row.code_hash as string, "hex");
  const actual = Buffer.from(hash(address, ticket.trim()), "hex");
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return false;
  await admin.from("email_codes").delete().eq("email", address).eq("purpose", "ticket");
  return true;
}

export function requestIp(request: Request): string | null {
  const forwarded = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || null;
}

/** Over the limit in the last hour (or `windowMs`)? Fails open if the log can't be read. */
export async function overRateLimit(
  admin: Admin,
  action: string,
  limits: { ip?: string | null; perIp?: number; email?: string; perEmail?: number },
  windowMs = WINDOW_MS
): Promise<boolean> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const count = async (column: "ip" | "email", value: string) => {
    const { count, error } = await admin
      .from("app_request_log")
      .select("id", { count: "exact", head: true })
      .eq("action", action)
      .eq(column, value)
      .gte("created_at", since);
    if (error) console.error("rate limit read failed", error);
    return count ?? 0;
  };
  if (limits.ip && limits.perIp && (await count("ip", limits.ip)) >= limits.perIp) return true;
  if (limits.email && limits.perEmail && (await count("email", normaliseEmail(limits.email))) >= limits.perEmail) return true;
  return false;
}

export async function recordRequest(admin: Admin, action: string, ip: string | null, email: string | null): Promise<void> {
  await admin.from("app_request_log").insert({ action, ip, email: email ? normaliseEmail(email) : null });
}

export async function accountIdForEmail(admin: Admin, email: string): Promise<string | null | "unknown"> {
  const { data, error } = await admin.rpc("nn_user_id_for_email", { check_email: email });
  if (error) {
    console.error("app-login: account lookup failed", error);
    return "unknown";
  }
  return (data as string | null) ?? null;
}

/** Asked for a meet & greet with this email (and not closed)? */
export async function hasOpenRequest(admin: Admin, email: string): Promise<boolean> {
  const { data, error } = await admin.rpc("nn_has_open_request", { check_email: email });
  if (error) console.error("app-login: request lookup failed", error);
  return data === true;
}

export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Please choose a password of at least 8 characters.";
  if (!/[^A-Za-z]/.test(password)) return "Please add a number or symbol to your password, like 7 or !";
  return null;
}
