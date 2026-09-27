"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "./ui/Field";
import { SelectCards } from "./ui/SelectCards";
import { AvatarUpload } from "./ui/AvatarUpload";
import { CheckCircleIcon } from "./ui/Icons";
import { DraftRestored, StepCard, WizardHeading, WizardNav, WizardProgress } from "./ui/WizardProgress";
import { clearFormDraft, loadFormDraft, saveFormDraft } from "@/lib/forms/draft";
import { booking, findService, priceFor } from "@/config/booking";
import { DOG_PHOTO_HANDOFF_KEY, EXTRA_DOGS_HANDOFF_KEY } from "@/lib/storage/photos";

// The owner-facing steps never repeat; only the dog steps do. Dog 1 lives in
// the flat fields below; any additional dogs (chosen on "How many dogs?") each
// get their own step, capturing the same details as the first.
const BASE_STEPS = [
  "About you",
  "Choose a service",
  "Booking options",
  "Your dog",
  "Behaviour",
  "Care & handling",
];
const FIRST_EXTRA = BASE_STEPS.length; // index of the first additional-dog step
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// Loose UK-friendly check: 10–15 digits once spaces, dashes, brackets and a leading + are removed.
const PHONE_RE = /^\+?\d{10,15}$/;
const DRAFT_KEY = "nn-booking-draft-v1";

type Data = Record<string, string>;

const INITIAL: Data = {
  firstName: "", lastName: "", email: "", phone: "", address: "", findUs: "",
  service: "", bookingType: "", dogs: "1",
  dogName: "", breed: "", gender: "", age: "", withDogs: "", withPeople: "",
  needHelp: "", allergies: "", tools: "", trust: "",
  company: "", // honeypot
};

/** One additional dog — the same fields collected for the first dog. */
type DogInput = {
  name: string; breed: string; gender: string; age: string;
  withDogs: string; withPeople: string; needHelp: string;
  allergies: string; tools: string; trust: string;
};
const blankDog = (): DogInput => ({
  name: "", breed: "", gender: "", age: "",
  withDogs: "", withPeople: "", needHelp: "",
  allergies: "", tools: "", trust: "",
});

/** What "Next" saves, so a half-finished request survives closing the tab. */
type BookingDraft = { step: number; data: Data; extraDogs: DogInput[]; photo: string | null };

export function BookingForm() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Data>(INITIAL);
  // Additional dogs (dog 2, dog 3…). Length is kept in sync with "How many dogs?".
  const [extraDogs, setExtraDogs] = useState<DogInput[]>([]);
  // Optional dog photo — kept out of the POST body (data URLs are large) and
  // handed to create-account via sessionStorage so it becomes the account image.
  const [photo, setPhoto] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "error" | "success">("idle");
  const [submitError, setSubmitError] = useState("");
  const [restored, setRestored] = useState(false);
  const [saved, setSaved] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const savedTimer = useRef<number | undefined>(undefined);
  const router = useRouter();

  // Pick up a saved draft on first load.
  useEffect(() => {
    const draft = loadFormDraft<BookingDraft>(DRAFT_KEY);
    if (!draft?.data) return;
    const d: Data = { ...INITIAL, ...draft.data, company: "" };
    const n = Math.max(0, (parseInt(d.dogs, 10) || 1) - 1);
    const dogs = (draft.extraDogs ?? []).slice(0, n).map((x) => ({ ...blankDog(), ...x }));
    while (dogs.length < n) dogs.push(blankDog());
    /* eslint-disable react-hooks/set-state-in-effect */
    setData(d);
    setExtraDogs(dogs);
    setPhoto(draft.photo ?? null);
    // Steps = base + extra dogs + meet & greet.
    setStep(Math.min(Math.max(0, draft.step ?? 0), BASE_STEPS.length + n));
    setRestored(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function persist(nextStep: number) {
    const draft: BookingDraft = { step: nextStep, data: { ...data, company: "" }, extraDogs, photo };
    // A big photo can overflow storage — keep the answers even if the photo won't fit.
    const ok = saveFormDraft(DRAFT_KEY, draft) || saveFormDraft(DRAFT_KEY, { ...draft, photo: null });
    if (!ok) return;
    setSaved(true);
    window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaved(false), 2000);
  }

  // Also save if they leave mid-step (switch apps, close the tab), not just on Next.
  const latest = useRef({ step, data, extraDogs, photo, status });
  useEffect(() => {
    latest.current = { step, data, extraDogs, photo, status };
  }, [step, data, extraDogs, photo, status]);
  useEffect(() => {
    const onHide = () => {
      const l = latest.current;
      if (document.visibilityState !== "hidden" || l.status === "success") return;
      const draft: BookingDraft = { step: l.step, data: { ...l.data, company: "" }, extraDogs: l.extraDogs, photo: l.photo };
      if (!saveFormDraft(DRAFT_KEY, draft)) saveFormDraft(DRAFT_KEY, { ...draft, photo: null });
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  function startOver() {
    clearFormDraft(DRAFT_KEY);
    setData(INITIAL);
    setExtraDogs([]);
    setPhoto(null);
    setErrors({});
    setStep(0);
    setRestored(false);
    scrollTop();
  }

  const set = (key: string) => (value: string) => {
    setData((d) => ({ ...d, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };

  const setService = (value: string) => {
    const svc = findService(value);
    setData((d) => ({
      ...d,
      service: value,
      bookingType: svc && svc.bookingTypes.length === 1 ? svc.bookingTypes[0].value : "",
    }));
    setErrors((e) => ({ ...e, service: "", bookingType: "" }));
  };

  const service = findService(data.service);
  const dogsNum = parseInt(data.dogs, 10) || 1;
  const price = priceFor(data.service, data.bookingType, dogsNum);

  // Steps grow with the dog count: base steps, then one step per extra dog,
  // then Meet & greet last.
  const extraCount = Math.max(0, dogsNum - 1);
  const steps = [
    ...BASE_STEPS,
    ...Array.from({ length: extraCount }, (_, i) => `Dog ${i + 2}`),
    "Meet & greet",
  ];
  const meetStep = steps.length - 1;
  const isExtraStep = (s: number) => s >= FIRST_EXTRA && s < meetStep;
  const extraIndex = (s: number) => s - FIRST_EXTRA;

  // Keep the additional-dog list the same length as the chosen count.
  const onDogsChange = (value: string) => {
    setData((d) => ({ ...d, dogs: value }));
    setErrors((e) => (e.dogs ? { ...e, dogs: "" } : e));
    const n = Math.max(0, (parseInt(value, 10) || 1) - 1);
    setExtraDogs((cur) => {
      const next = cur.slice(0, n);
      while (next.length < n) next.push(blankDog());
      return next;
    });
  };

  const setExtra = (idx: number, key: keyof DogInput) => (value: string) => {
    setExtraDogs((cur) => cur.map((d, i) => (i === idx ? { ...d, [key]: value } : d)));
    setErrors((e) => (e[`d${idx}_${key}`] ? { ...e, [`d${idx}_${key}`]: "" } : e));
  };

  function validate(s: number) {
    const e: Record<string, string> = {};
    const req = (k: string) => {
      if (!data[k]?.trim()) e[k] = "Please fill this in.";
    };
    if (isExtraStep(s)) {
      const idx = extraIndex(s);
      const dog = extraDogs[idx];
      const rq = (k: keyof DogInput) => {
        if (!dog?.[k]?.trim()) e[`d${idx}_${k}`] = "Please fill this in.";
      };
      rq("name"); rq("breed"); rq("age");
      rq("withDogs"); rq("withPeople"); rq("needHelp");
      rq("allergies"); rq("tools");
      if (!dog?.gender) e[`d${idx}_gender`] = "Please choose.";
      if (!dog?.trust) e[`d${idx}_trust`] = "Please choose.";
      return e;
    }
    switch (s) {
      case 0: // About you
        req("firstName"); req("lastName"); req("email"); req("phone"); req("address");
        if (data.email && !EMAIL_RE.test(data.email.trim())) e.email = "Enter a valid email address.";
        if (data.phone && !PHONE_RE.test(data.phone.replace(/[\s\-()]/g, ""))) e.phone = "Enter a valid phone number.";
        break;
      case 1: // Choose a service
        if (!data.service) e.service = "Please choose a service.";
        break;
      case 2: // Booking options
        if (!data.bookingType) e.bookingType = "Please choose an option.";
        if (!data.dogs || !(dogsNum >= 1)) e.dogs = "Enter a number (1 or more).";
        break;
      case 3: // Your dog
        req("dogName"); req("breed"); req("age");
        if (!data.gender) e.gender = "Please choose.";
        break;
      case 4: // Behaviour
        req("withDogs"); req("withPeople"); req("needHelp");
        break;
      case 5: // Care & handling
        req("allergies"); req("tools");
        if (!data.trust) e.trust = "Please choose.";
        break;
    }
    return e;
  }

  // Start each new step at the top of the page. Deferring to the next frame
  // lets React swap in the new step first; then we move focus to the top of
  // the form BEFORE scrolling — this clears focus from the "Next" button,
  // whose retained focus would otherwise anchor the page part-way down as the
  // taller/shorter step renders, and it announces the new step to screen readers.
  const scrollTop = () =>
    requestAnimationFrame(() => {
      topRef.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

  function next() {
    const e = validate(step);
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    const ns = Math.min(step + 1, steps.length - 1);
    setErrors({});
    setStep(ns);
    persist(ns);
    scrollTop();
  }

  function back() {
    jump(Math.max(step - 1, 0));
  }

  /** Go straight to an earlier step (from Back or the progress circles), saving first. */
  function jump(target: number) {
    setErrors({});
    setStep(target);
    persist(target);
    scrollTop();
  }

  async function submit() {
    for (let s = 0; s < steps.length - 1; s++) {
      const e = validate(s);
      if (Object.keys(e).length) {
        setErrors(e);
        setStep(s);
        scrollTop();
        return;
      }
    }
    setStatus("submitting");
    setSubmitError("");
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, extraDogs }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(json.error || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      // Request sent — take them to create an account, prefilled from the form.
      clearFormDraft(DRAFT_KEY);
      setStatus("success");
      // Hand the chosen photo + any extra dogs to create-account (files and
      // arrays can't ride in the URL).
      try {
        if (photo) sessionStorage.setItem(DOG_PHOTO_HANDOFF_KEY, photo);
        else sessionStorage.removeItem(DOG_PHOTO_HANDOFF_KEY);
        if (extraDogs.length) sessionStorage.setItem(EXTRA_DOGS_HANDOFF_KEY, JSON.stringify(extraDogs));
        else sessionStorage.removeItem(EXTRA_DOGS_HANDOFF_KEY);
      } catch {
        /* ignore */
      }
      const params = new URLSearchParams();
      const prefill: Record<string, string> = {
        name: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        dogName: data.dogName,
        breed: data.breed,
        age: data.age,
      };
      for (const [k, v] of Object.entries(prefill)) {
        if (v?.trim()) params.set(k, v.trim());
      }
      router.push(`/create-account?${params.toString()}`);
    } catch {
      setSubmitError("Couldn’t reach the server. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div ref={topRef} className="rounded-2xl border border-white/10 bg-ink-soft p-8 text-center animate-fade-up">
        <CheckCircleIcon width={44} height={44} className="mx-auto text-accent" />
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-paper">Request sent</h2>
        <p className="mx-auto mt-3 max-w-md text-paper/75">
          Thanks {data.firstName || "there"} — taking you to create your
          account…
        </p>
      </div>
    );
  }

  const dogNames = [data.dogName, ...extraDogs.map((d) => d.name)].filter((n) => n?.trim());

  return (
    <div ref={topRef} tabIndex={-1} className="scroll-mt-24 outline-none">
      <WizardHeading title={steps[step]} step={step} total={steps.length} saved={saved} />
      <div className="mt-5">
        <WizardProgress steps={steps} current={step} onJump={status === "submitting" ? undefined : jump} />
      </div>

      {restored && <DraftRestored onStartOver={startOver} />}

      {/* Honeypot */}
      <div className="hidden" aria-hidden="true">
        <label>
          Company
          <input
            tabIndex={-1}
            autoComplete="off"
            value={data.company}
            onChange={(e) => set("company")(e.target.value)}
          />
        </label>
      </div>

      <StepCard key={step}>
        {step === 0 && (
          <div className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="First name" name="firstName" required value={data.firstName} onChange={set("firstName")} error={errors.firstName} />
              <Field label="Last name" name="lastName" required value={data.lastName} onChange={set("lastName")} error={errors.lastName} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Email" name="email" type="email" inputMode="email" required value={data.email} onChange={set("email")} error={errors.email} placeholder="you@example.com" />
              <Field label="Phone" name="phone" type="tel" inputMode="tel" required value={data.phone} onChange={set("phone")} error={errors.phone} placeholder="07123 456789" />
            </div>
            <Field label="Address & postcode" name="address" required value={data.address} onChange={set("address")} error={errors.address} placeholder="Street, town, postcode" />
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="mb-2 block text-sm text-paper-dim">
              Service type <span className="text-paper-dim/70">*</span>
            </p>
            <SelectCards
              ariaLabel="Service type"
              options={booking.services.map((s) => ({ value: s.value, label: s.label, desc: s.desc, icon: s.icon }))}
              value={data.service}
              onChange={setService}
            />
            {errors.service && <p className="mt-1.5 text-sm text-red-400">{errors.service}</p>}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-6">
            {service && (
              <div>
                <p className="mb-2 block text-sm text-paper-dim">
                  Booking type <span className="text-paper-dim/70">*</span>
                </p>
                <SelectCards
                  ariaLabel="Booking type"
                  options={service.bookingTypes.map((b) => ({
                    value: b.value,
                    label: b.label,
                    desc: b.desc,
                    price: `£${b.base} per ${b.unit}`,
                  }))}
                  value={data.bookingType}
                  onChange={set("bookingType")}
                />
                {errors.bookingType && <p className="mt-1.5 text-sm text-red-400">{errors.bookingType}</p>}
              </div>
            )}

            <div>
              <Field label="How many dogs?" name="dogs" required value={data.dogs} onChange={onDogsChange} error={errors.dogs} options={booking.dogCounts} />
              <p className="mt-2 text-sm text-paper-dim">{booking.copy.dogsNote}</p>
              {dogsNum > 1 && (
                <p className="mt-1 text-sm text-accent">
                  You&apos;ll add {dogsNum === 2 ? "your second dog’s" : `your other ${dogsNum - 1} dogs’`}{" "}
                  details on their own step{dogsNum === 2 ? "" : "s"} after your first.
                </p>
              )}
            </div>

            {price && (
              <div className="rounded-lg border border-white/10 bg-ink p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Estimated price</p>
                <p className="display-heading mt-2 text-3xl text-paper">
                  £{price.total}{" "}
                  <span className="text-base font-normal text-paper/60">per {price.unit}</span>
                </p>
                {dogsNum > 1 && (
                  <p className="mt-1 text-sm text-paper-dim">
                    {dogsNum} dogs · £{price.base} first dog, £{price.base - booking.secondDogDiscount} each additional
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-5">
            {dogsNum > 1 && (
              <p className="rounded-lg border border-white/10 bg-ink px-4 py-2.5 text-sm text-paper/80">
                This is your <b className="text-paper">first dog</b>. You&apos;ll add your
                other {dogsNum === 2 ? "dog" : `${dogsNum - 1} dogs`} on the next step
                {dogsNum === 2 ? "" : "s"} — same questions each time.
              </p>
            )}
            {/* Optional dog photo — becomes their account picture. */}
            <div>
              <AvatarUpload value={photo} onSelect={setPhoto} size={104} />
              <p className="mt-2 text-center text-sm text-paper-dim">
                Add a photo of {dogsNum > 1 ? "your first dog" : "your dog"}{" "}
                <span className="text-paper/50">(optional)</span>
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Dog's name" name="dogName" required value={data.dogName} onChange={set("dogName")} error={errors.dogName} />
              <Field label="Breed" name="breed" required value={data.breed} onChange={set("breed")} error={errors.breed} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 block text-sm text-paper-dim">
                  Gender <span className="text-paper-dim/70">*</span>
                </p>
                <SelectCards ariaLabel="Gender" options={booking.genders} value={data.gender} onChange={set("gender")} />
                {errors.gender && <p className="mt-1.5 text-sm text-red-400">{errors.gender}</p>}
              </div>
              <Field label="Age" name="age" required value={data.age} onChange={set("age")} error={errors.age} placeholder="e.g. 2 years" />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-5">
            <p className="text-paper/70">{booking.copy.dogIntro}</p>
            <Field label="How are they with other dogs?" name="withDogs" required textarea rows={2} value={data.withDogs} onChange={set("withDogs")} error={errors.withDogs} placeholder={booking.placeholders.withDogs} />
            <Field label="How are they with other people?" name="withPeople" required textarea rows={2} value={data.withPeople} onChange={set("withPeople")} error={errors.withPeople} placeholder={booking.placeholders.withPeople} />
            <Field label="What do you need help with?" name="needHelp" required textarea rows={2} value={data.needHelp} onChange={set("needHelp")} error={errors.needHelp} placeholder={booking.placeholders.needHelp} />
          </div>
        )}

        {step === 5 && (
          <div className="grid gap-5">
            <Field label="Any allergies?" name="allergies" required value={data.allergies} onChange={set("allergies")} error={errors.allergies} placeholder={booking.placeholders.allergies} />
            <Field label="What lead / tools do you use during walks?" name="tools" required value={data.tools} onChange={set("tools")} error={errors.tools} placeholder={booking.placeholders.tools} />
            <div className="rounded-lg border border-white/10 bg-ink p-4 text-sm text-paper/70">
              {booking.copy.toolsNote}
            </div>
            <div>
              <p className="mb-2 block text-sm text-paper-dim">
                {booking.copy.trustQuestion} <span className="text-paper-dim/70">*</span>
              </p>
              <SelectCards ariaLabel="Trust our guidance" options={booking.yesNo} value={data.trust} onChange={set("trust")} />
              {errors.trust && <p className="mt-1.5 text-sm text-red-400">{errors.trust}</p>}
            </div>
          </div>
        )}

        {isExtraStep(step) && (() => {
          const idx = extraIndex(step);
          const dog = extraDogs[idx] ?? blankDog();
          const err = (k: string) => errors[`d${idx}_${k}`];
          return (
            <div className="grid gap-5">
              <p className="text-paper/70">
                Dog {idx + 2} — the same details as your first, for their own profile.
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Dog's name" name={`d${idx}_name`} required value={dog.name} onChange={setExtra(idx, "name")} error={err("name")} />
                <Field label="Breed" name={`d${idx}_breed`} required value={dog.breed} onChange={setExtra(idx, "breed")} error={err("breed")} />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="mb-2 block text-sm text-paper-dim">
                    Gender <span className="text-paper-dim/70">*</span>
                  </p>
                  <SelectCards ariaLabel={`Gender (dog ${idx + 2})`} options={booking.genders} value={dog.gender} onChange={setExtra(idx, "gender")} />
                  {err("gender") && <p className="mt-1.5 text-sm text-red-400">{err("gender")}</p>}
                </div>
                <Field label="Age" name={`d${idx}_age`} required value={dog.age} onChange={setExtra(idx, "age")} error={err("age")} placeholder="e.g. 2 years" />
              </div>
              <Field label="How are they with other dogs?" name={`d${idx}_withDogs`} required textarea rows={2} value={dog.withDogs} onChange={setExtra(idx, "withDogs")} error={err("withDogs")} placeholder={booking.placeholders.withDogs} />
              <Field label="How are they with other people?" name={`d${idx}_withPeople`} required textarea rows={2} value={dog.withPeople} onChange={setExtra(idx, "withPeople")} error={err("withPeople")} placeholder={booking.placeholders.withPeople} />
              <Field label="What do you need help with?" name={`d${idx}_needHelp`} required textarea rows={2} value={dog.needHelp} onChange={setExtra(idx, "needHelp")} error={err("needHelp")} placeholder={booking.placeholders.needHelp} />
              <Field label="Any allergies?" name={`d${idx}_allergies`} required value={dog.allergies} onChange={setExtra(idx, "allergies")} error={err("allergies")} placeholder={booking.placeholders.allergies} />
              <Field label="What lead / tools do you use during walks?" name={`d${idx}_tools`} required value={dog.tools} onChange={setExtra(idx, "tools")} error={err("tools")} placeholder={booking.placeholders.tools} />
              <div>
                <p className="mb-2 block text-sm text-paper-dim">
                  {booking.copy.trustQuestion} <span className="text-paper-dim/70">*</span>
                </p>
                <SelectCards ariaLabel={`Trust our guidance (dog ${idx + 2})`} options={booking.yesNo} value={dog.trust} onChange={setExtra(idx, "trust")} />
                {err("trust") && <p className="mt-1.5 text-sm text-red-400">{err("trust")}</p>}
              </div>
            </div>
          );
        })()}

        {step === meetStep && (
          <div className="grid gap-4 text-paper/75">
            {booking.copy.meetGreet.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <div className="rounded-lg border border-white/10 bg-ink p-4 text-sm">
              <p className="font-semibold text-paper/90">Your request</p>
              <p className="mt-1 text-paper/70">
                {service?.label}
                {data.bookingType && service ? ` · ${service.bookingTypes.find((b) => b.value === data.bookingType)?.label}` : ""}
                {price ? ` · £${price.total} per ${price.unit}` : ""}
                {dogNames.length ? ` · ${dogNames.join(", ")}` : ""}
              </p>
            </div>
          </div>
        )}

        {Object.values(errors).some(Boolean) && (
          <p role="alert" className="mt-6 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            Please check the highlighted {Object.values(errors).filter(Boolean).length === 1 ? "field" : "fields"} above.
          </p>
        )}
        {submitError && (
          <p role="alert" className="mt-6 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            {submitError}
          </p>
        )}

        <WizardNav
          onBack={step > 0 ? back : undefined}
          onNext={step < steps.length - 1 ? next : submit}
          nextLabel={step < steps.length - 1 ? "Next" : "Submit request"}
          busy={status === "submitting"}
          busyLabel="Sending…"
        />
      </StepCard>
    </div>
  );
}
