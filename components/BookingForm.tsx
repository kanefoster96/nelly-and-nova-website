"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Field } from "./ui/Field";
import { SelectCards } from "./ui/SelectCards";
import { CheckCircleIcon, CheckIcon, MapPinIcon, PlusIcon } from "./ui/Icons";
import { DraftRestored, StepCard, WizardHeading, WizardNav, WizardProgress } from "./ui/WizardProgress";
import { clearFormDraft, loadFormDraft, saveFormDraft } from "@/lib/forms/draft";
import { checkPostcode, meetGreet } from "@/config/booking";
import { EXTRA_DOGS_HANDOFF_KEY } from "@/lib/storage/photos";

/**
 * Free meet & greet request — four short steps, laid out like Kanvas
 * Academy's free trial form:
 *   1. Your dog (name, breed, age — and any more dogs)
 *   2. What you're interested in (Full Day / 1-1 / Not sure yet)
 *   3. What you'd like help with (pick any)
 *   4. Your details + a postcode check
 * Then "Thanks — we'll be in touch". No times to pick: we read it, ask a few
 * questions and arrange a day to meet their dog.
 */

const STEPS = ["Your dog", "What you're after", "What you'd like help with", "Your details"];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^\+?\d{10,15}$/;
const DRAFT_KEY = "nn-meet-greet-draft-v2";

type Dog = { name: string; breed: string; age: string };
type Data = {
  dogs: Dog[];
  service: string;
  help: string[];
  helpOther: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  postcode: string;
  company: string; // honeypot
};

const blankDog = (): Dog => ({ name: "", breed: "", age: "" });
const INITIAL: Data = {
  dogs: [blankDog()],
  service: "",
  help: [],
  helpOther: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  postcode: "",
  company: "",
};

type Draft = { step: number; data: Data };

function dogNames(dogs: Dog[]): string {
  const names = dogs.map((d) => d.name.trim()).filter(Boolean);
  if (names.length <= 1) return names[0] ?? "your dog";
  return `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
}

export function BookingForm() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Data>(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [submitError, setSubmitError] = useState("");
  const [restored, setRestored] = useState(false);
  const [saved, setSaved] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const savedTimer = useRef<number | undefined>(undefined);

  // Pick up a saved draft on first load.
  useEffect(() => {
    const draft = loadFormDraft<Draft>(DRAFT_KEY);
    if (!draft?.data) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setData({ ...INITIAL, ...draft.data, dogs: draft.data.dogs?.length ? draft.data.dogs : [blankDog()], company: "" });
    setStep(Math.min(Math.max(0, draft.step ?? 0), STEPS.length - 1));
    setRestored(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function persist(nextStep: number) {
    if (!saveFormDraft(DRAFT_KEY, { step: nextStep, data: { ...data, company: "" } })) return;
    setSaved(true);
    window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaved(false), 2000);
  }

  function scrollTop() {
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function startOver() {
    clearFormDraft(DRAFT_KEY);
    setData(INITIAL);
    setErrors({});
    setStep(0);
    setRestored(false);
    scrollTop();
  }

  const set = <K extends keyof Data>(key: K) => (value: Data[K]) => {
    setData((d) => ({ ...d, [key]: value }));
    setErrors((e) => (e[key as string] ? { ...e, [key as string]: "" } : e));
  };

  const setDog = (i: number, key: keyof Dog) => (value: string) => {
    setData((d) => ({ ...d, dogs: d.dogs.map((dog, j) => (j === i ? { ...dog, [key]: value } : dog)) }));
    setErrors((e) => (e[`dog${i}_${key}`] ? { ...e, [`dog${i}_${key}`]: "" } : e));
  };

  function toggleHelp(value: string) {
    setData((d) => ({ ...d, help: d.help.includes(value) ? d.help.filter((h) => h !== value) : [...d.help, value] }));
    setErrors((e) => ({ ...e, help: "" }));
  }

  function validate(s: number): Record<string, string> {
    const e: Record<string, string> = {};
    if (s === 0) {
      data.dogs.forEach((dog, i) => {
        if (!dog.name.trim()) e[`dog${i}_name`] = "Please add their name.";
        if (!dog.breed.trim()) e[`dog${i}_breed`] = "Please add their breed (or best guess).";
        if (!dog.age.trim()) e[`dog${i}_age`] = "Please add their age.";
      });
    }
    if (s === 1 && !data.service) e.service = "Please choose one — “Not sure yet” is fine.";
    if (s === 2) {
      if (data.help.length === 0) e.help = "Pick at least one.";
      if (data.help.includes("other") && !data.helpOther.trim()) e.helpOther = "Tell us a little about it.";
    }
    if (s === 3) {
      if (!data.firstName.trim()) e.firstName = "Please add your first name.";
      if (!data.lastName.trim()) e.lastName = "Please add your last name.";
      if (!EMAIL_RE.test(data.email.trim())) e.email = "Enter a valid email address.";
      if (!PHONE_RE.test(data.phone.replace(/[\s\-()]/g, ""))) e.phone = "Enter a valid phone number.";
      if (checkPostcode(data.postcode).status === "invalid") e.postcode = "Enter your full postcode, e.g. NE30 4AA.";
    }
    return e;
  }

  function next() {
    const e = validate(step);
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setErrors({});
    persist(step + 1);
    setStep(step + 1);
    setRestored(false);
    scrollTop();
  }

  function back() {
    setErrors({});
    setStep(step - 1);
    scrollTop();
  }

  async function submit() {
    const e = validate(3);
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setStatus("submitting");
    setSubmitError("");
    const pc = checkPostcode(data.postcode);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          dogs: data.dogs.map((d) => ({ name: d.name.trim(), breed: d.breed.trim(), age: d.age.trim() })),
          postcode: pc.formatted ?? data.postcode.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(json.error || "Something went wrong. Please try again.");
        setStatus("idle");
        return;
      }
      clearFormDraft(DRAFT_KEY);
      setStatus("success");
      scrollTop();
    } catch {
      setSubmitError("Couldn't reach us just now. Please check your connection and try again.");
      setStatus("idle");
    }
  }

  const names = dogNames(data.dogs);

  // Their details carry into sign-up, so it's just a password.
  const createAccountHref = `/create-account?${new URLSearchParams({
    name: data.firstName.trim(),
    lastName: data.lastName.trim(),
    email: data.email.trim(),
    phone: data.phone.trim(),
    address: checkPostcode(data.postcode).formatted ?? data.postcode.trim(),
    dogName: data.dogs[0]?.name.trim() ?? "",
    breed: data.dogs[0]?.breed.trim() ?? "",
    next: "/profile",
  })}`;
  function handOffDogs() {
    try {
      sessionStorage.setItem(
        EXTRA_DOGS_HANDOFF_KEY,
        JSON.stringify(data.dogs.slice(1).map((d) => ({ name: d.name.trim(), breed: d.breed.trim() })))
      );
    } catch {
      /* ignore */
    }
  }

  if (status === "success") {
    return (
      <div ref={topRef} className="rounded-3xl border border-white/10 bg-ink-soft px-6 py-12 text-center animate-fade-up sm:px-10">
        <CheckCircleIcon width={56} height={56} className="mx-auto text-paper" />
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-paper-dim">Free meet &amp; greet</p>
        <h2 className="display-heading mt-3 text-3xl uppercase text-paper sm:text-4xl">We&apos;ll be in touch</h2>
        <p className="mx-auto mt-4 max-w-md text-paper/75">
          Thanks {data.firstName.trim() || "for getting in touch"}! We&apos;ll read through everything you&apos;ve told us
          about {names}, give you a call or message with a few questions, and book a day that suits you to meet{" "}
          {data.dogs.length > 1 ? "them" : names} — completely free.
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm text-paper-dim">
          We&apos;ve emailed you a copy. Usually we&apos;re back in touch within a day or two.
        </p>
        {/* Like Kanvas's trial bookings: an account now means they can chat
            with us and follow their request in the app straight away. */}
        <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-white/10 bg-ink p-5 text-left">
          <p className="font-semibold text-paper">Create your account</p>
          <p className="mt-1 text-sm text-paper/70">
            Message us in the app, see when your meet &amp; greet is booked, and get updates — just add a password.
          </p>
          <Link
            href={createAccountHref}
            onClick={handOffDogs}
            className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
          >
            Create account
          </Link>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/" className="glass inline-flex min-h-[44px] items-center rounded-full px-6 text-sm font-semibold text-paper">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const pc = checkPostcode(data.postcode);

  return (
    <div ref={topRef} className="scroll-mt-28">
      <WizardProgress steps={STEPS} current={step} onJump={(i) => setStep(i)} />
      {restored && <DraftRestored onStartOver={startOver} />}

      <StepCard key={step}>
        <WizardHeading kicker="Free meet & greet" title={STEPS[step]} step={step} total={STEPS.length} saved={saved} />

        {/* Honeypot: hidden from people, filled in by bots. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor="company">Leave this empty</label>
          <input id="company" tabIndex={-1} autoComplete="off" value={data.company} onChange={(e) => set("company")(e.target.value)} />
        </div>

        {step === 0 && (
          <div className="mt-6 grid gap-6">
            {data.dogs.map((dog, i) => (
              <div key={i} className={i > 0 ? "grid gap-5 border-t border-white/10 pt-6" : "grid gap-5"}>
                {data.dogs.length > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-paper">Dog {i + 1}</p>
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => setData((d) => ({ ...d, dogs: d.dogs.filter((_, j) => j !== i) }))}
                        className="text-sm text-paper-dim underline underline-offset-2 hover:text-paper"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}
                <Field label="Dog's name" name={`dog${i}_name`} required value={dog.name} onChange={setDog(i, "name")} error={errors[`dog${i}_name`]} />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Breed" name={`dog${i}_breed`} required value={dog.breed} onChange={setDog(i, "breed")} error={errors[`dog${i}_breed`]} placeholder="e.g. Cocker Spaniel" />
                  <Field label="Age" name={`dog${i}_age`} required value={dog.age} onChange={setDog(i, "age")} error={errors[`dog${i}_age`]} placeholder="e.g. 18 months" />
                </div>
              </div>
            ))}
            {data.dogs.length < 4 && (
              <button
                type="button"
                onClick={() => setData((d) => ({ ...d, dogs: [...d.dogs, blankDog()] }))}
                className="glass inline-flex items-center justify-center gap-2 self-start rounded-full px-4 py-2 text-sm font-medium text-paper"
              >
                <PlusIcon width={16} height={16} />
                Add another dog
              </button>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="mt-6">
            <p className="mb-4 text-paper/70">What are you interested in for {names}?</p>
            <SelectCards
              ariaLabel="What you're interested in"
              columns={3}
              options={meetGreet.services.map((s) => ({ value: s.value, label: s.label, desc: s.desc, icon: s.icon }))}
              value={data.service}
              onChange={set("service")}
            />
            {errors.service && <p className="mt-2 text-sm text-red-400">{errors.service}</p>}
          </div>
        )}

        {step === 2 && (
          <div className="mt-6">
            <p className="mb-4 text-paper/70">What would you like help with? Pick as many as you like.</p>
            <div role="group" aria-label="What you'd like help with" className="grid grid-cols-2 gap-3">
              {meetGreet.help.map((h) => {
                const on = data.help.includes(h.value);
                return (
                  <button
                    key={h.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleHelp(h.value)}
                    className={`relative flex min-h-[72px] items-center justify-center rounded-2xl border px-4 py-4 text-center text-sm font-semibold transition-colors ${
                      on ? "border-accent bg-accent text-accent-ink" : "border-white/10 bg-ink text-paper hover:border-white/30"
                    }`}
                  >
                    {on && <CheckIcon width={16} height={16} className="absolute right-3 top-3" />}
                    {h.label}
                  </button>
                );
              })}
            </div>
            {errors.help && <p className="mt-2 text-sm text-red-400">{errors.help}</p>}
            {data.help.includes("other") && (
              <div className="mt-5">
                <Field
                  label="Tell us a little more"
                  name="helpOther"
                  required
                  textarea
                  rows={3}
                  value={data.helpOther}
                  onChange={set("helpOther")}
                  error={errors.helpOther}
                  placeholder="e.g. barking at the door, recall, nervous with visitors…"
                />
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="mt-6 grid gap-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="First name" name="firstName" required value={data.firstName} onChange={set("firstName")} error={errors.firstName} />
              <Field label="Last name" name="lastName" required value={data.lastName} onChange={set("lastName")} error={errors.lastName} />
            </div>
            <Field label="Email" name="email" type="email" inputMode="email" required value={data.email} onChange={set("email")} error={errors.email} placeholder="you@example.com" />
            <Field label="Phone" name="phone" type="tel" inputMode="tel" required value={data.phone} onChange={set("phone")} error={errors.phone} placeholder="07123 456789" />
            <div>
              <Field label="Postcode" name="postcode" required value={data.postcode} onChange={set("postcode")} error={errors.postcode} placeholder="e.g. NE30 4AA" />
              {/* Live check: can we get to them? Never blocks the request. */}
              {pc.status === "covered" && (
                <p className="mt-2 flex items-center gap-2 text-sm text-emerald-300">
                  <MapPinIcon width={16} height={16} />
                  Great — we cover {pc.area}.
                </p>
              )}
              {pc.status === "outside" && data.service === "online-training" && (
                <p className="mt-2 flex items-center gap-2 text-sm text-emerald-300">
                  <MapPinIcon width={16} height={16} />
                  Online Training works wherever you are.
                </p>
              )}
              {pc.status === "outside" && data.service !== "online-training" && (
                <p className="mt-2 flex items-start gap-2 text-sm text-amber-300">
                  <MapPinIcon width={16} height={16} className="mt-0.5 shrink-0" />
                  We don&apos;t usually travel to {pc.outward}, but send your request and we&apos;ll let you know if we can.
                </p>
              )}
            </div>
            <p className="text-xs text-paper-dim">
              We&apos;ll only use these to arrange your meet &amp; greet. See our{" "}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-paper">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        )}

        {submitError && (
          <p role="alert" className="mt-6 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            {submitError}
          </p>
        )}

        <WizardNav
          onBack={step > 0 ? back : undefined}
          onNext={step < STEPS.length - 1 ? next : submit}
          nextLabel={step < STEPS.length - 1 ? "Next" : "Send request"}
          busy={status === "submitting"}
          busyLabel="Sending…"
        />
      </StepCard>
    </div>
  );
}
