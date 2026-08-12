"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { SelectCards } from "./ui/SelectCards";
import { AvatarUpload } from "./ui/AvatarUpload";
import { CheckCircleIcon } from "./ui/Icons";
import { booking, findService, priceFor } from "@/config/booking";
import { DOG_PHOTO_HANDOFF_KEY } from "@/lib/storage/photos";

// Short steps so each fits a phone screen without scrolling — the long "about
// your dog" section is split into your dog / behaviour / care & handling.
const STEPS = [
  "About you",
  "Choose a service",
  "Booking options",
  "Your dog",
  "Behaviour",
  "Care & handling",
  "Meet & greet",
];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Data = Record<string, string>;

const INITIAL: Data = {
  firstName: "", lastName: "", email: "", phone: "", address: "", findUs: "",
  service: "", bookingType: "", dogs: "1",
  dogName: "", breed: "", gender: "", age: "", withDogs: "", withPeople: "",
  needHelp: "", allergies: "", tools: "", trust: "",
  company: "", // honeypot
};

export function BookingForm() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Data>(INITIAL);
  // Optional dog photo — kept out of the POST body (data URLs are large) and
  // handed to create-account via sessionStorage so it becomes the account image.
  const [photo, setPhoto] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "error" | "success">("idle");
  const [submitError, setSubmitError] = useState("");
  const topRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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
  const dogsNum = parseInt(data.dogs, 10);
  const price = priceFor(data.service, data.bookingType, dogsNum);

  function validate(s: number) {
    const e: Record<string, string> = {};
    const req = (k: string) => {
      if (!data[k]?.trim()) e[k] = "Please fill this in.";
    };
    switch (s) {
      case 0: // About you
        req("firstName"); req("lastName"); req("email"); req("phone"); req("address");
        if (data.email && !EMAIL_RE.test(data.email)) e.email = "Enter a valid email address.";
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
  // taller/shorter step renders (the "I had to scroll up myself" bug), and it
  // announces the new step to screen readers.
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
    setErrors({});
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    scrollTop();
  }

  function back() {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
    scrollTop();
  }

  async function submit() {
    for (let s = 0; s < STEPS.length - 1; s++) {
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
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(json.error || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      // Request sent — take them to create an account, prefilled from the form.
      setStatus("success");
      // Hand the chosen photo to create-account (files can't ride in the URL).
      try {
        if (photo) sessionStorage.setItem(DOG_PHOTO_HANDOFF_KEY, photo);
        else sessionStorage.removeItem(DOG_PHOTO_HANDOFF_KEY);
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
      <div ref={topRef} className="rounded-3xl bg-white/[0.04] p-8 text-center ring-1 ring-white/10">
        <CheckCircleIcon width={44} height={44} className="mx-auto text-accent" />
        <h2 className="display-heading mt-4 text-3xl text-paper">Request sent</h2>
        <p className="mx-auto mt-3 max-w-md text-paper/75">
          Thanks {data.firstName || "there"} — taking you to create your
          account…
        </p>
      </div>
    );
  }

  return (
    <div ref={topRef} tabIndex={-1} className="outline-none">
      {/* Progress */}
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">
        Step {step + 1} of {STEPS.length}
      </p>
      <div
        className="mt-3 grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${STEPS.length}, 1fr)` }}
        aria-hidden="true"
      >
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`h-1.5 rounded-full ${i <= step ? "bg-paper" : "bg-white/15"}`}
          />
        ))}
      </div>
      <h2 className="display-heading mt-5 text-2xl text-paper sm:text-3xl">
        {STEPS[step]}
      </h2>

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

      <div className="mt-6">
        {step === 0 && (
          <div className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="First name" name="firstName" required value={data.firstName} onChange={set("firstName")} error={errors.firstName} />
              <Field label="Last name" name="lastName" required value={data.lastName} onChange={set("lastName")} error={errors.lastName} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Email" name="email" type="email" inputMode="email" required value={data.email} onChange={set("email")} error={errors.email} placeholder="you@example.com" />
              <Field label="Phone" name="phone" type="tel" inputMode="tel" required value={data.phone} onChange={set("phone")} error={errors.phone} placeholder="07000 000000" />
            </div>
            <Field label="Address & postcode" name="address" required value={data.address} onChange={set("address")} error={errors.address} placeholder="Street, town, postcode" />
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="mb-2 block text-sm font-medium text-paper/90">
              Service type <span className="text-paper-dim">*</span>
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
                <p className="mb-2 block text-sm font-medium text-paper/90">
                  Booking type <span className="text-paper-dim">*</span>
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
              <Field label="How many dogs?" name="dogs" required value={data.dogs} onChange={set("dogs")} error={errors.dogs} options={booking.dogCounts} />
              <p className="mt-2 text-sm text-paper-dim">{booking.copy.dogsNote}</p>
            </div>

            {price && (
              <div className="rounded-2xl border border-white/15 bg-white/[0.05] p-5">
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
            {/* Optional dog photo — becomes their account picture. */}
            <div>
              <AvatarUpload value={photo} onSelect={setPhoto} size={104} />
              <p className="mt-2 text-center text-sm text-paper-dim">
                Add a photo of your dog{" "}
                <span className="text-paper/50">(optional)</span>
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Dog's name" name="dogName" required value={data.dogName} onChange={set("dogName")} error={errors.dogName} />
              <Field label="Breed" name="breed" required value={data.breed} onChange={set("breed")} error={errors.breed} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 block text-sm font-medium text-paper/90">
                  Gender <span className="text-paper-dim">*</span>
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
            <div className="rounded-2xl bg-white/[0.03] p-4 text-sm text-paper/70 ring-1 ring-white/5">
              {booking.copy.toolsNote}
            </div>
            <div>
              <p className="mb-2 block text-sm font-medium text-paper/90">
                {booking.copy.trustQuestion} <span className="text-paper-dim">*</span>
              </p>
              <SelectCards ariaLabel="Trust our guidance" options={booking.yesNo} value={data.trust} onChange={set("trust")} />
              {errors.trust && <p className="mt-1.5 text-sm text-red-400">{errors.trust}</p>}
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="grid gap-4 text-paper/75">
            {booking.copy.meetGreet.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <div className="rounded-2xl bg-white/[0.03] p-4 text-sm ring-1 ring-white/5">
              <p className="font-semibold text-paper/90">Your request</p>
              <p className="mt-1 text-paper/70">
                {service?.label}
                {data.bookingType && service ? ` · ${service.bookingTypes.find((b) => b.value === data.bookingType)?.label}` : ""}
                {price ? ` · £${price.total} per ${price.unit}` : ""}
                {data.dogName ? ` · ${data.dogName}` : ""}
              </p>
            </div>
          </div>
        )}
      </div>

      {(status === "error" || submitError) && (
        <p role="alert" className="mt-6 text-sm text-red-400">
          {submitError}
        </p>
      )}

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between gap-4">
        {step > 0 ? (
          <Button variant="secondary" radius="xl" onClick={back} disabled={status === "submitting"}>
            Back
          </Button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <Button radius="xl" onClick={next}>
            Next
          </Button>
        ) : (
          <Button
            radius="xl"
            size="lg"
            onClick={submit}
            disabled={status === "submitting"}
            className="disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "submitting" ? "Sending…" : "Submit request"}
          </Button>
        )}
      </div>
    </div>
  );
}
