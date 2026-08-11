"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { CheckCircleIcon } from "./ui/Icons";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function SignupForm() {
  const params = useSearchParams();
  const [firstName, setFirstName] = useState(params.get("name") ?? "");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!firstName.trim()) er.firstName = "Please enter your name.";
    if (!EMAIL_RE.test(email)) er.email = "Enter a valid email address.";
    if (password.length < 8) er.password = "Use at least 8 characters.";
    if (confirm !== password) er.confirm = "Passwords don't match.";
    if (Object.keys(er).length) {
      setErrors(er);
      return;
    }
    setErrors({});
    setStatus("submitting");
    // TODO(backend): supabase.auth.signUp({ email, password,
    //   options: { data: { first_name: firstName } } }) then link the account
    // to the just-submitted request. Scaffold: no auth backend yet.
    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="rounded-3xl bg-white/[0.04] p-8 text-center ring-1 ring-white/10">
        <CheckCircleIcon width={40} height={40} className="mx-auto text-accent" />
        <h2 className="display-heading mt-4 text-2xl text-paper">
          You&apos;re all set
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-paper/75">
          Your request has already been sent — we&apos;ll be in touch soon.
          Accounts aren&apos;t switched on just yet, so there&apos;s nothing more
          you need to do for now.
        </p>
        <div className="mt-6 flex justify-center">
          <Button href="/" variant="secondary" radius="xl">
            Back to home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10 sm:p-8"
    >
      <div className="grid gap-5">
        <Field label="First name" name="firstName" required value={firstName} onChange={setFirstName} error={errors.firstName} placeholder="Your name" />
        <Field label="Email" name="email" type="email" inputMode="email" required value={email} onChange={setEmail} error={errors.email} placeholder="you@example.com" />
        <Field label="Password" name="password" type="password" required value={password} onChange={setPassword} error={errors.password} placeholder="At least 8 characters" />
        <Field label="Confirm password" name="confirm" type="password" required value={confirm} onChange={setConfirm} error={errors.confirm} placeholder="Re-enter your password" />

        <Button size="lg" radius="xl" disabled={status === "submitting"} className="disabled:opacity-60">
          Create account
        </Button>

        <p className="text-center text-sm text-paper-dim">
          <Link href="/" className="underline underline-offset-2 hover:text-accent">
            Maybe later
          </Link>
        </p>
      </div>
    </form>
  );
}
