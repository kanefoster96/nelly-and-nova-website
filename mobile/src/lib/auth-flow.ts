import { config } from "@/lib/config";
import { supabase } from "@/lib/supabase";

/**
 * The calls behind the app's email-first log in (like Kanvas Academy's),
 * all on the website under /api/mobile/auth:
 *
 *   email → lookup: has it an account?
 *     yes → password → signed in (forgot it: send-link → the email's
 *           button → create a password)
 *     no, but asked for a meet & greet → send-link → the email's button →
 *           create a password (and their name) → signed in
 *     neither → "No account yet": ask for a free meet & greet
 *
 * The emailed button proves the inbox is theirs: it opens the app on
 * "Create a password" carrying a one-use ticket (+native-intent.tsx).
 */
type Answer<T> = ({ ok: true } & T) | { ok: false; message: string; retryAfter?: number };

async function post<T extends object = object>(path: string, payload: object): Promise<Answer<T>> {
  let res: Response;
  try {
    res = await fetch(new URL(path, config.siteUrl).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, message: "We couldn't reach the server. Check your connection and try again." };
  }
  const body = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string; retryAfter?: number } & T) | null;
  if (res.ok && body?.ok) return { ...body, ok: true } as { ok: true } & T;
  return { ok: false, message: body?.error ?? "Something went wrong. Please try again.", retryAfter: body?.retryAfter };
}

export const lookupAccount = (email: string) => post<{ account: boolean; known: boolean }>("/api/mobile/auth/lookup", { email });
export const sendLoginLink = (email: string) => post("/api/mobile/auth/send-link", { email });
export const setPasswordWithTicket = (input: { email: string; ticket: string; password: string; name?: string }) =>
  post("/api/mobile/auth/set-password", input);

export const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/;

/** Signs in; null when it worked, otherwise the words to show. Gives up after 20s. */
export async function signInWithPassword(email: string, password: string): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const result = await Promise.race([
    supabase.auth.signInWithPassword({ email: email.trim(), password }),
    new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), 20_000);
    }),
  ]);
  clearTimeout(timer);
  if (result === "timeout") return "Logging in is taking longer than it should. Check your connection and try again.";
  if (!result.error) return null;
  if (result.error.code === "email_not_confirmed") {
    return "Your account needs its email confirming. Tap “Forgot password?” and we'll email you a button to set it up.";
  }
  if (result.error.code === "invalid_credentials") return "That password isn't right. Try again, or tap “Forgot password?” to set a new one.";
  return result.error.message;
}

export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < 8) return "At least 8 characters.";
  if (!/[^A-Za-z]/.test(password)) return "Add a number or symbol, like 7 or !";
  if (confirm && password !== confirm) return "The two passwords don't match.";
  return null;
}
