"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { AvatarUpload } from "./ui/AvatarUpload";
import { CheckCircleIcon } from "./ui/Icons";
import { DOG_PHOTO_HANDOFF_KEY } from "@/lib/storage/photos";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const STEPS = ["Your details", "Your dog"];

/** A single labelled line inside a summary card. */
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="shrink-0 text-sm text-paper-dim">{label}</span>
      <span className={`text-right text-sm ${value ? "text-paper" : "text-paper-dim/60"}`}>
        {value || "Not added"}
      </span>
    </div>
  );
}

/** Card header with an "Edit" button on the right. */
function CardHeader({ title, onEdit }: { title: string; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{title}</p>
      <button
        type="button"
        onClick={onEdit}
        className="rounded-full border border-white/20 px-3 py-1 text-xs font-medium text-paper transition-colors hover:border-white/45"
      >
        Edit
      </button>
    </div>
  );
}

export function SignupForm() {
  const params = useSearchParams();
  const fromForm = params.has("email") || params.has("name");
  const dogFromForm = params.has("dogName");

  const [step, setStep] = useState(0);
  // Owner (prefilled from the request when redirected from a form).
  const [firstName, setFirstName] = useState(params.get("name") ?? "");
  const [lastName, setLastName] = useState(params.get("lastName") ?? "");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [phone, setPhone] = useState(params.get("phone") ?? "");
  const [address, setAddress] = useState(params.get("address") ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // Dog (the account's main profile).
  const [dogName, setDogName] = useState(params.get("dogName") ?? "");
  const [breed, setBreed] = useState(params.get("breed") ?? "");
  const [age, setAge] = useState(params.get("age") ?? "");
  const [dogNotes, setDogNotes] = useState("");
  // Prefill the photo if one was chosen during the booking form (handed off
  // via sessionStorage, since a file can't ride along in the URL).
  const [photo, setPhoto] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return sessionStorage.getItem(DOG_PHOTO_HANDOFF_KEY);
    } catch {
      return null;
    }
  });

  // When details arrive from the booking form we show them on a card so it's
  // clear the only thing left to do is set a password (and confirm the dog).
  // A fresh sign-up (nothing prefilled) starts in edit mode instead.
  const [editDetails, setEditDetails] = useState(!fromForm);
  const [editDog, setEditDog] = useState(!dogFromForm);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");

  function next() {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = "Please enter your name.";
    if (!EMAIL_RE.test(email)) e.email = "Enter a valid email address.";
    if (password.length < 8) e.password = "Use at least 8 characters.";
    if (confirm !== password) e.confirm = "Passwords don't match.";
    if (Object.keys(e).length) {
      // If a collapsed detail is wrong, open the card so it can be fixed.
      if (e.firstName || e.email) setEditDetails(true);
      setErrors(e);
      return;
    }
    setErrors({});
    setStep(1);
  }

  function create() {
    if (!dogName.trim()) {
      setEditDog(true);
      setErrors({ dogName: "Please add your dog's name." });
      return;
    }
    setErrors({});
    setStatus("submitting");
    // TODO(backend): supabase.auth.signUp({ email, password, options: { data:
    //   { first_name: firstName } } }), then create the dog profile (name,
    //   breed, age, notes) and, if `photo` is set, uploadDogPhoto(photo, userId)
    //   from lib/storage/photos.ts to set the account image.
    try {
      sessionStorage.removeItem(DOG_PHOTO_HANDOFF_KEY);
    } catch {
      /* ignore */
    }
    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="rounded-3xl bg-white/[0.04] p-8 text-center ring-1 ring-white/10">
        {photo ? (
          <span className="mx-auto block h-20 w-20 overflow-hidden rounded-full ring-2 ring-accent">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="h-full w-full object-cover" />
          </span>
        ) : (
          <CheckCircleIcon width={40} height={40} className="mx-auto text-accent" />
        )}
        <h2 className="display-heading mt-4 text-2xl text-paper">You&apos;re all set</h2>
        <p className="mx-auto mt-3 max-w-sm text-paper/75">
          One last step to finish onboarding — complete your consent &amp; waiver.
          It saves as you go, so you can come back any time.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button href="/waiver" radius="xl">
            Complete consent &amp; waiver
          </Button>
          <Button href="/" variant="secondary" radius="xl">
            Back to home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">
        Step {step + 1} of {STEPS.length} · {STEPS[step]}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2" aria-hidden="true">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`h-1.5 rounded-full ${i <= step ? "bg-paper" : "bg-white/15"}`}
          />
        ))}
      </div>

      <div className="mt-6 rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10 sm:p-8">
        {step === 0 ? (
          <div className="grid gap-5">
            {editDetails ? (
              <div className="grid gap-5">
                <p className="text-sm text-paper/70">
                  {fromForm
                    ? "Check these are right for your account."
                    : "Enter your details to create your account."}
                </p>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="First name" name="firstName" required value={firstName} onChange={setFirstName} error={errors.firstName} />
                  <Field label="Last name" name="lastName" value={lastName} onChange={setLastName} />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Email" name="email" type="email" inputMode="email" required value={email} onChange={setEmail} error={errors.email} />
                  <Field label="Phone" name="phone" type="tel" inputMode="tel" value={phone} onChange={setPhone} />
                </div>
                <Field label="Address & postcode" name="address" value={address} onChange={setAddress} />
                {fromForm && (
                  <button
                    type="button"
                    onClick={() => setEditDetails(false)}
                    className="justify-self-start rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-paper transition-colors hover:bg-white/15"
                  >
                    Done
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/15 bg-white/[0.03] p-4">
                <CardHeader title="Your details" onEdit={() => setEditDetails(true)} />
                <div className="mt-2 divide-y divide-white/10">
                  <SummaryRow label="Name" value={`${firstName} ${lastName}`.trim()} />
                  <SummaryRow label="Email" value={email} />
                  <SummaryRow label="Phone" value={phone} />
                  <SummaryRow label="Address" value={address} />
                </div>
              </div>
            )}

            {/* The one thing left to do on this page. */}
            <div className="grid gap-4 rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10">
              <div>
                <p className="text-sm font-semibold text-paper">Set a password</p>
                <p className="mt-0.5 text-sm text-paper-dim">
                  That&apos;s all we need — choose a password to finish creating your account.
                </p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Password" name="password" type="password" required value={password} onChange={setPassword} error={errors.password} placeholder="At least 8 characters" />
                <Field label="Confirm password" name="confirm" type="password" required value={confirm} onChange={setConfirm} error={errors.confirm} placeholder="Re-enter your password" />
              </div>
            </div>

            <Button size="lg" radius="xl" onClick={next}>
              Next
            </Button>
            <p className="text-center text-sm text-paper-dim">
              <Link href="/" className="underline underline-offset-2 hover:text-accent">
                Maybe later
              </Link>
            </p>
          </div>
        ) : (
          <div className="grid gap-5">
            {/* Dog photo — becomes the account picture. Always available to add. */}
            <div>
              <AvatarUpload value={photo} onSelect={setPhoto} size={112} />
              <p className="mt-2 text-center text-sm text-paper-dim">
                {photo ? "Photo added — it becomes your account picture." : "Add a photo of your dog "}
                {!photo && <span className="text-paper/50">(optional)</span>}
              </p>
            </div>

            {editDog ? (
              <div className="grid gap-5">
                <Field label="Dog's name" name="dogName" required value={dogName} onChange={setDogName} error={errors.dogName} />
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Breed" name="breed" value={breed} onChange={setBreed} />
                  <Field label="Age" name="age" value={age} onChange={setAge} placeholder="e.g. 2 years" />
                </div>
                <Field label="Anything else?" name="dogNotes" textarea rows={3} value={dogNotes} onChange={setDogNotes} placeholder="Anything else you'd like on your dog's profile" />
                {dogFromForm && (
                  <button
                    type="button"
                    onClick={() => dogName.trim() && setEditDog(false)}
                    className="justify-self-start rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-paper transition-colors hover:bg-white/15"
                  >
                    Done
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/15 bg-white/[0.03] p-4">
                <CardHeader title="Your dog" onEdit={() => setEditDog(true)} />
                <div className="mt-2 divide-y divide-white/10">
                  <SummaryRow label="Name" value={dogName} />
                  <SummaryRow label="Breed" value={breed} />
                  <SummaryRow label="Age" value={age} />
                  {dogNotes.trim() && <SummaryRow label="Notes" value={dogNotes} />}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <Button variant="secondary" radius="xl" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button size="lg" radius="xl" onClick={create} disabled={status === "submitting"} className="disabled:opacity-60">
                Confirm &amp; create account
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
