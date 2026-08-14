"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { AvatarUpload } from "./ui/AvatarUpload";
import { CheckCircleIcon } from "./ui/Icons";
import { DOG_PHOTO_HANDOFF_KEY } from "@/lib/storage/photos";
import { signUpNewAccount } from "@/lib/auth/session";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Create an account — the essentials only: a photo, your name, email and a
 * password. Dogs are added later from the profile, so onboarding stays quick.
 */
export function SignupForm() {
  const params = useSearchParams();

  // Prefilled when redirected from the booking/enquiry form.
  const [firstName, setFirstName] = useState(params.get("name") ?? "");
  const [lastName, setLastName] = useState(params.get("lastName") ?? "");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // Prefill the photo if one was chosen during the booking form (handed off via
  // sessionStorage, since a file can't ride along in the URL).
  const [photo, setPhoto] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return sessionStorage.getItem(DOG_PHOTO_HANDOFF_KEY);
    } catch {
      return null;
    }
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");

  async function create() {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = "Please enter your name.";
    if (!EMAIL_RE.test(email)) e.email = "Enter a valid email address.";
    if (password.length < 8) e.password = "Use at least 8 characters.";
    if (confirm !== password) e.confirm = "Passwords don't match.";
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setErrors({});
    setFormError(null);
    setStatus("submitting");

    const { error, needsConfirmation } = await signUpNewAccount({
      email: email.trim(),
      password,
      ownerName: `${firstName} ${lastName}`.trim(),
      avatarUrl: photo ?? undefined,
    });

    if (error) {
      setStatus("idle");
      setFormError(error);
      return;
    }

    try {
      sessionStorage.removeItem(DOG_PHOTO_HANDOFF_KEY);
    } catch {
      /* ignore */
    }
    setNeedsConfirm(needsConfirmation);
    setStatus("success");
  }

  if (status === "success") {
    // Email confirmation is on — the account exists but can't sign in until the
    // link is clicked, so send them to their inbox rather than the waiver.
    if (needsConfirm) {
      return (
        <div className="rounded-3xl bg-white/[0.04] p-8 text-center ring-1 ring-white/10">
          <CheckCircleIcon width={40} height={40} className="mx-auto text-accent" />
          <h2 className="display-heading mt-4 text-2xl text-paper">Confirm your email</h2>
          <p className="mx-auto mt-3 max-w-sm text-paper/75">
            We&apos;ve sent a confirmation link to <span className="text-paper">{email}</span>.
            Click it to activate your account, then log in.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button href="/login" radius="xl">
              Go to log in
            </Button>
            <Button href="/" variant="secondary" radius="xl">
              Back to home
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-3xl bg-white/[0.04] p-8 text-center ring-1 ring-white/10">
        {photo ? (
          <span className="mx-auto block h-20 w-20 overflow-hidden rounded-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="h-full w-full object-cover" />
          </span>
        ) : (
          <CheckCircleIcon width={40} height={40} className="mx-auto text-accent" />
        )}
        <h2 className="display-heading mt-4 text-2xl text-paper">You&apos;re all set</h2>
        <p className="mx-auto mt-3 max-w-sm text-paper/75">
          Your account is ready. Add your dog and complete your consent &amp; waiver
          whenever you like — it all saves as you go.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button href="/profile" radius="xl">
            Go to your profile
          </Button>
          <Button href="/waiver" variant="secondary" radius="xl">
            Consent &amp; waiver
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10 sm:p-8">
      <form
        className="grid gap-6"
        onSubmit={(ev) => {
          ev.preventDefault();
          void create();
        }}
      >
        {/* Photo — becomes the account picture. Optional. */}
        <div>
          <AvatarUpload value={photo} onSelect={setPhoto} size={112} />
          <p className="mt-2 text-center text-sm text-paper-dim">
            {photo ? (
              "Photo added — it becomes your account picture."
            ) : (
              <>
                Add a profile photo <span className="text-paper/50">(optional)</span>
              </>
            )}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="First name" name="firstName" required value={firstName} onChange={setFirstName} error={errors.firstName} />
          <Field label="Last name" name="lastName" value={lastName} onChange={setLastName} />
        </div>

        <Field label="Email" name="email" type="email" inputMode="email" required value={email} onChange={setEmail} error={errors.email} placeholder="you@example.com" />

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Password" name="password" type="password" required value={password} onChange={setPassword} error={errors.password} placeholder="At least 8 characters" />
          <Field label="Confirm password" name="confirm" type="password" required value={confirm} onChange={setConfirm} error={errors.confirm} placeholder="Re-enter your password" />
        </div>

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
          {status === "submitting" ? "Creating account…" : "Create account"}
        </Button>

        <p className="text-center text-sm text-paper-dim">
          You can add your dog&apos;s details later from your profile.
        </p>
        <p className="text-center text-sm text-paper-dim">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-paper underline underline-offset-2 hover:text-accent">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
