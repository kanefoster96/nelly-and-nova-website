"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { createClient } from "@/lib/supabase/client";

type State = "checking" | "ready" | "invalid" | "saving" | "done";

/**
 * Step 2 of a password reset: the link from the email lands here signed in
 * with a short-lived recovery session, and the customer picks a new password.
 *
 * Handles every shape of link Supabase can send:
 *   ?code=…                       (default PKCE link, same browser)
 *   ?token_hash=…&type=recovery   (custom email template — works on any device)
 *   #access_token=…               (older implicit links, picked up automatically)
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const [state, setState] = useState<State>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const code = params.get("code");
      if (tokenHash) {
        await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
      }
      // getSession waits for the client to finish reading any code/token in the URL.
      let { data } = await supabase.auth.getSession();
      if (!data.session && code) {
        await supabase.auth.exchangeCodeForSession(code);
        ({ data } = await supabase.auth.getSession());
      }
      if (cancelled) return;
      // Tidy the one-time token out of the address bar.
      if (tokenHash || code) window.history.replaceState(null, "", "/reset-password");
      setState(data.session ? "ready" : "invalid");
    })().catch(() => !cancelled && setState("invalid"));
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError("");
    setState("saving");
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setState("ready");
      setError(/same/i.test(err.message) ? "That's your current password — choose a new one." : err.message);
      return;
    }
    setState("done");
    const { data } = await supabase.from("profiles").select("role").single();
    window.setTimeout(() => router.push(data?.role === "admin" ? "/admin" : "/profile"), 1500);
  }

  if (state === "checking") {
    return <div className="rounded-2xl border border-white/10 bg-ink-soft p-8 text-center text-paper-dim">Checking your link…</div>;
  }

  if (state === "invalid") {
    return (
      <div className="rounded-2xl border border-white/10 bg-ink-soft p-6 text-center sm:p-8">
        <h2 className="text-xl font-semibold text-paper">This link has expired</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm text-paper-dim">
          Reset links only work once and for a short time. Request a new one and open it on this device.
        </p>
        <div className="mt-6 flex justify-center">
          <Button href="/forgot-password" radius="xl">Send a new link</Button>
        </div>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-white/10 bg-ink-soft p-8 text-center">
        <h2 className="text-xl font-semibold text-paper">Password updated</h2>
        <p className="mt-3 text-sm text-paper-dim">You&apos;re signed in — taking you to your account…</p>
      </div>
    );
  }

  return (
    <form
      className="grid gap-5 rounded-2xl border border-white/10 bg-ink-soft p-6 sm:p-8"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Field label="New password" name="password" type="password" required value={password} onChange={setPassword} placeholder="At least 8 characters" />
      <Field label="Confirm new password" name="confirm" type="password" required value={confirm} onChange={setConfirm} error={error} />
      <Button type="submit" size="lg" radius="xl" disabled={state === "saving"} className="disabled:opacity-60">
        {state === "saving" ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
