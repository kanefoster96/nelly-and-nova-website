"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { signInWithPassword } from "@/lib/auth/session";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting">("idle");

  async function submit() {
    const e: Record<string, string> = {};
    if (!EMAIL_RE.test(email)) e.email = "Enter a valid email address.";
    if (!password) e.password = "Enter your password.";
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setErrors({});
    setFormError(null);
    setStatus("submitting");

    const { error, role } = await signInWithPassword(email.trim(), password);
    if (error) {
      setStatus("idle");
      setFormError(error);
      return;
    }
    router.push(role === "admin" ? "/admin" : "/profile");
  }

  return (
    <div className="rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10 sm:p-8">
      <form
        className="grid gap-5"
        onSubmit={(ev) => {
          ev.preventDefault();
          void submit();
        }}
      >
        <Field
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          required
          value={email}
          onChange={setEmail}
          error={errors.email}
          placeholder="you@example.com"
        />
        <Field
          label="Password"
          name="password"
          type="password"
          required
          value={password}
          onChange={setPassword}
          error={errors.password}
        />
        {formError && (
          <p className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300 ring-1 ring-red-500/20">
            {formError}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          radius="xl"
          disabled={status === "submitting"}
          className="disabled:opacity-60"
        >
          {status === "submitting" ? "Logging in…" : "Log in"}
        </Button>
        <p className="text-center text-sm text-paper-dim">
          New here?{" "}
          <Link
            href="/create-account"
            className="font-semibold text-paper underline underline-offset-2 hover:text-accent"
          >
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}
