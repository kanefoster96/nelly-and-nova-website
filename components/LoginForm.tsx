"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { signIn, SAMPLE_ADMIN } from "@/lib/auth/session";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "submitting">("idle");

  function submit() {
    const e: Record<string, string> = {};
    if (!EMAIL_RE.test(email)) e.email = "Enter a valid email address.";
    if (!password) e.password = "Enter your password.";
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setErrors({});
    setStatus("submitting");
    // TODO(backend): supabase.auth.signInWithPassword({ email, password }), then
    // route by role (is_staff() → /admin, otherwise /profile).
    // Scaffold: a coach/admin email signs in as staff; anyone else as a member.
    if (/coach|admin|charlotte/i.test(email)) {
      signIn(SAMPLE_ADMIN);
      router.push("/admin");
    } else {
      signIn();
      router.push("/profile");
    }
  }

  function loginAsCoach() {
    signIn(SAMPLE_ADMIN);
    router.push("/admin");
  }

  return (
    <div className="rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10 sm:p-8">
      <div className="grid gap-5">
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
        <Button
          size="lg"
          radius="xl"
          onClick={submit}
          disabled={status === "submitting"}
          className="disabled:opacity-60"
        >
          Log in
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
        {/* Scaffold shortcut — remove once real staff auth is wired. */}
        <button
          type="button"
          onClick={loginAsCoach}
          className="text-center text-xs text-paper-dim underline underline-offset-2 hover:text-accent"
        >
          Log in as coach (demo)
        </button>
      </div>
    </div>
  );
}
