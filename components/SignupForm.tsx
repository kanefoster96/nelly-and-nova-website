"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { AvatarUpload } from "./ui/AvatarUpload";
import { CheckCircleIcon, EyeIcon, EyeOffIcon, MailIcon, ArrowRightIcon } from "./ui/Icons";
import { DOG_PHOTO_HANDOFF_KEY, EXTRA_DOGS_HANDOFF_KEY } from "@/lib/storage/photos";
import { signUpNewAccount } from "@/lib/auth/session";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** 0–4: length, a number, upper + lower case, a symbol. */
function passwordScore(pw: string): number {
  if (!pw) return 0;
  let score = pw.length >= 8 ? 1 : 0;
  if (pw.length >= 12) score++;
  if (/\d/.test(pw) && /[a-zA-Z]/.test(pw)) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}
const STRENGTH = ["Too short", "Okay", "Good", "Strong", "Very strong"];

/**
 * Create an account — the essentials only: a photo, your name, email and a
 * password. Anything brought over from the meet & greet form (phone, address,
 * dogs) is saved with it, so nothing is asked twice; more dogs can be added
 * from the profile later.
 */
export function SignupForm() {
  const params = useSearchParams();

  // Prefilled when redirected from the booking/enquiry form.
  const [firstName, setFirstName] = useState(params.get("name") ?? "");
  const [lastName, setLastName] = useState(params.get("lastName") ?? "");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // A photo chosen during the booking form (handed over via sessionStorage).
  const [photo, setPhoto] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return sessionStorage.getItem(DOG_PHOTO_HANDOFF_KEY);
    } catch {
      return null;
    }
  });

  const phone = params.get("phone") ?? "";
  const address = params.get("address") ?? "";
  const [dogs] = useState(() => {
    const first = params.get("dogName")?.trim();
    const list: { name: string; breed?: string }[] = first ? [{ name: first, breed: params.get("breed") ?? undefined }] : [];
    if (typeof window !== "undefined") {
      try {
        const extra = JSON.parse(sessionStorage.getItem(EXTRA_DOGS_HANDOFF_KEY) ?? "[]") as { name?: string; breed?: string }[];
        for (const d of extra) if (d.name?.trim()) list.push({ name: d.name.trim(), breed: d.breed });
      } catch {
        /* ignore */
      }
    }
    return list;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");

  const score = passwordScore(password);

  async function create() {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = "Please enter your first name.";
    if (!EMAIL_RE.test(email.trim())) e.email = "Enter a valid email address.";
    if (password.length < 8) e.password = "Use at least 8 characters.";
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setErrors({});
    setFormError(null);
    setStatus("submitting");

    const { error, needsConfirmation } = await signUpNewAccount({
      email: email.trim().toLowerCase(),
      password,
      ownerName: `${firstName.trim()} ${lastName.trim()}`.trim(),
      avatarUrl: photo ?? undefined,
      dogs,
      phone,
      address,
    });

    if (error) {
      setStatus("idle");
      setFormError(error);
      return;
    }

    try {
      sessionStorage.removeItem(DOG_PHOTO_HANDOFF_KEY);
      sessionStorage.removeItem(EXTRA_DOGS_HANDOFF_KEY);
    } catch {
      /* ignore */
    }
    setNeedsConfirm(needsConfirmation);
    setStatus("success");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (status === "success") {
    // Email confirmation is on: the account exists but can't log in until
    // the link is clicked.
    if (needsConfirm) {
      return (
        <div className="text-center">
          <span className="glass mx-auto flex h-16 w-16 items-center justify-center rounded-full text-paper">
            <MailIcon width={28} height={28} />
          </span>
          <h2 className="display-heading mt-5 text-2xl uppercase text-paper">Check your email</h2>
          <p className="mx-auto mt-3 max-w-sm text-paper/75">
            We&apos;ve sent a link to <span className="font-semibold text-paper">{email.trim()}</span>. Tap it to
            confirm your account and you&apos;ll go straight to your profile.
          </p>
          <p className="mx-auto mt-3 max-w-sm text-sm text-paper-dim">
            Can&apos;t see it? Check your spam folder, or give it a minute.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
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
      <div className="text-center">
        {photo ? (
          <span className="mx-auto block h-20 w-20 overflow-hidden rounded-full ring-2 ring-white/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="h-full w-full object-cover" />
          </span>
        ) : (
          <CheckCircleIcon width={48} height={48} className="mx-auto text-paper" />
        )}
        <h2 className="display-heading mt-5 text-2xl uppercase text-paper">
          Welcome{firstName.trim() ? `, ${firstName.trim()}` : ""}!
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-paper/75">
          Your account is ready.{" "}
          {dogs.length ? `${dogs.map((d) => d.name).join(" & ")} ${dogs.length > 1 ? "are" : "is"} on it already. ` : "Add your dog from your profile, "}
          and complete your consent &amp; waiver whenever you like — it all saves as you go.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button href="/profile" radius="xl">
            Go to your profile
            <ArrowRightIcon width={18} height={18} />
          </Button>
          <Button href="/waiver" variant="secondary" radius="xl">
            Consent &amp; waiver
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        void create();
      }}
    >
      {/* Photo — becomes the account picture. Optional. */}
      <div>
        <AvatarUpload value={photo} onSelect={setPhoto} size={96} />
        <p className="mt-2 text-center text-sm text-paper-dim">
          {photo ? "Looking good — that's your account picture." : "Add a photo of your dog (optional)"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="First name" name="firstName" required value={firstName} onChange={setFirstName} error={errors.firstName} />
        <Field label="Last name" name="lastName" value={lastName} onChange={setLastName} />
      </div>

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

      {/* Password with show/hide and a strength bar (no second "confirm" box). */}
      <div>
        <label htmlFor="password" className="mb-2 block text-sm text-paper-dim">
          Password<span className="text-paper-dim/70"> *</span>
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors.password}
            aria-describedby="password-help"
            placeholder="At least 8 characters"
            className="w-full rounded-lg border border-white/10 bg-ink px-4 py-2.5 pr-12 text-sm text-paper outline-none transition-colors placeholder:text-paper-dim/70 focus:border-white/40 aria-[invalid=true]:border-red-400/60"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-paper-dim hover:text-paper"
          >
            {showPassword ? <EyeOffIcon width={18} height={18} /> : <EyeIcon width={18} height={18} />}
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3" id="password-help">
          <div className="flex flex-1 gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  password && i < Math.max(score, 1) ? (score <= 1 ? "bg-amber-400" : "bg-emerald-400") : "bg-white/10"
                }`}
              />
            ))}
          </div>
          <span className="w-24 text-right text-xs text-paper-dim">
            {password ? (password.length < 8 ? STRENGTH[0] : STRENGTH[score]) : ""}
          </span>
        </div>
        {errors.password && <p className="mt-1.5 text-sm text-red-300">{errors.password}</p>}
      </div>

      {dogs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-paper-dim">
          <span>We&apos;ll add</span>
          {dogs.map((d) => (
            <span key={d.name} className="rounded-full bg-white/[0.08] px-3 py-1 font-semibold text-paper ring-1 ring-white/15">
              {d.name}
            </span>
          ))}
          <span>to your account.</span>
        </div>
      )}

      {formError && (
        <p role="alert" className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300 ring-1 ring-red-500/20">
          {formError}
          {/already exists/.test(formError) && (
            <>
              {" "}
              <Link href="/login" className="font-semibold underline underline-offset-2">
                Log in
              </Link>
            </>
          )}
        </p>
      )}

      <Button type="submit" size="lg" radius="xl" disabled={status === "submitting"} className="mt-1 w-full disabled:opacity-60">
        {status === "submitting" ? "Creating your account…" : "Create account"}
        {status !== "submitting" && <ArrowRightIcon width={18} height={18} />}
      </Button>

      <p className="text-center text-xs text-paper-dim">
        By creating an account you agree to our{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-paper">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-paper">
          Privacy Policy
        </Link>
        .
      </p>

      <p className="border-t border-white/10 pt-5 text-center text-sm text-paper-dim">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-paper underline underline-offset-2 hover:text-accent">
          Log in
        </Link>
      </p>
    </form>
  );
}
