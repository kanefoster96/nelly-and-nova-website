"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { createClient } from "@/lib/supabase/client";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Step 1 of a password reset: ask Supabase to email a reset link that comes
 * back to /reset-password. The same "check your inbox" message shows whether
 * or not the email has an account, so the form can't be used to find out who
 * is a customer.
 */
export function ForgotPasswordForm({ initialEmail = "" }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  async function submit() {
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setStatus("sending");
    const { error: err } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    // Rate limits are worth telling them about; anything else we treat as sent.
    if (err && /rate limit|too many/i.test(err.message)) {
      setStatus("idle");
      setError("Too many reset emails requested. Please wait a few minutes and try again.");
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="rounded-2xl border border-white/10 bg-ink-soft p-6 text-center sm:p-8">
        <h2 className="text-xl font-semibold text-paper">Check your inbox</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm text-paper-dim">
          If there&apos;s an account for <span className="text-paper">{email.trim()}</span>, we&apos;ve
          sent a link to reset your password. It can take a minute or two — check your spam folder too.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button href="/login" radius="xl">Back to log in</Button>
          <Button variant="secondary" radius="xl" onClick={() => setStatus("idle")}>Try another email</Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="grid gap-5 rounded-2xl border border-white/10 bg-ink-soft p-6 sm:p-8"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Field label="Email" name="email" type="email" inputMode="email" required value={email} onChange={setEmail} error={error} placeholder="you@example.com" />
      <Button type="submit" size="lg" radius="xl" disabled={status === "sending"} className="disabled:opacity-60">
        {status === "sending" ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-center text-sm text-paper-dim">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-paper underline underline-offset-2 hover:text-accent">
          Log in
        </Link>
      </p>
    </form>
  );
}
