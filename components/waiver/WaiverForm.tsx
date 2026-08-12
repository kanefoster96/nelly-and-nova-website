"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectCards } from "@/components/ui/SelectCards";
import { CheckIcon, CheckCircleIcon } from "@/components/ui/Icons";
import { useSession } from "@/lib/auth/session";
import {
  clearDraft,
  emptyWaiver,
  loadDraft,
  saveDraft,
  type WaiverData,
} from "@/lib/waiver/draft";
import { submitWaiver } from "@/lib/waiver/data";
import { setWaiverSigned } from "@/lib/onboarding/store";
import {
  countryOptions,
  dialCodes,
  genderOptions,
  waiverAgreement,
  waiverClauses,
  waiverTitle,
  yesNo,
} from "@/config/waiver";
import { SignaturePad } from "./SignaturePad";

// Kept short so each screen fits a phone without scrolling — long sections are
// split into parts (e.g. dog details across basics / vaccinations / health / vet).
const STEPS = [
  "About you",
  "Your address",
  "Dog’s details · basics",
  "Dog’s details · vaccinations",
  "Dog’s details · health",
  "Dog’s details · vet",
  "Consent & waiver",
  "Sign & submit",
];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function WaiverForm() {
  const session = useSession();
  const [data, setData] = useState<WaiverData>(emptyWaiver);
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [restored, setRestored] = useState(false);
  const [saved, setSaved] = useState(false);
  const [signing, setSigning] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);

  // Restore a saved draft, or prefill from the signed-in account. Runs on mount
  // and again if the session arrives late; only fills fields still empty.
  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      const draft = loadDraft();
      if (draft) {
        /* eslint-disable react-hooks/set-state-in-effect */
        setData(draft.data);
        setStep(draft.step);
        setCompleted(draft.completed);
        setRestored(true);
        /* eslint-enable react-hooks/set-state-in-effect */
        return;
      }
    }
    if (session) {
      const [first, ...rest] = session.ownerName.split(" ");
      const today = new Date().toISOString().slice(0, 10);
      setData((d) => ({
        ...d,
        firstName: d.firstName || first || "",
        lastName: d.lastName || rest.join(" ") || "",
        clientName: d.clientName || session.ownerName || "",
        dogName: d.dogName || session.dogName || "",
        signDate: d.signDate || today,
      }));
    }
  }, [session]);

  const set = (key: keyof WaiverData) => (value: string) => {
    setData((d) => ({ ...d, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };
  const toggle = (key: keyof WaiverData) => {
    setData((d) => ({ ...d, [key]: !d[key] }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  function validate(s: number): Record<string, string> {
    const e: Record<string, string> = {};
    const req = (k: keyof WaiverData) => {
      if (!String(data[k] ?? "").trim()) e[k] = "Please fill this in.";
    };
    switch (s) {
      case 0: // About you
        req("firstName"); req("lastName"); req("email"); req("em1"); req("em2");
        if (data.email && !EMAIL_RE.test(data.email)) e.email = "Enter a valid email address.";
        break;
      case 1: // Address
        req("country"); req("address"); req("city"); req("postcode");
        break;
      case 2: // Dog basics
        req("dogName"); req("breed"); req("age"); req("gender"); req("microchip");
        break;
      case 3: // Vaccinations
        if (!data.vaccFile) e.vaccFile = "Please upload the vaccination record.";
        if (!data.vaccConfirmed) e.vaccConfirmed = "Please confirm.";
        if (!data.kennelCough) e.kennelCough = "Please choose one.";
        break;
      case 4: // Health
        if (!data.medical) e.medical = "Please choose one.";
        if (data.medical === "yes") req("medicalDetails");
        if (!data.allergies) e.allergies = "Please choose one.";
        if (data.allergies === "yes") req("allergyDetails");
        break;
      case 5: // Vet
        req("vetName"); req("vetPhone"); req("vetAddress");
        break;
      case 6: // Agreement
        if (!data.agreed) e.agreed = "Please confirm you agree to the terms.";
        break;
      case 7: // Sign
        req("clientName"); req("signDate");
        if (!data.signature) e.signature = "Please add your signature.";
        break;
    }
    return e;
  }

  function persist(nextStep: number, nextCompleted: number[]) {
    saveDraft({ step: nextStep, completed: nextCompleted, data });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  function next() {
    const e = validate(step);
    if (Object.keys(e).length) {
      setErrors(e);
      scrollTop();
      return;
    }
    const nextCompleted = Array.from(new Set([...completed, step]));
    const ns = Math.min(step + 1, STEPS.length - 1);
    setCompleted(nextCompleted);
    setErrors({});
    setStep(ns);
    persist(ns, nextCompleted);
    scrollTop();
  }

  function back() {
    const ps = Math.max(step - 1, 0);
    setErrors({});
    setStep(ps);
    persist(ps, completed);
    scrollTop();
  }

  async function submit() {
    for (let s = 0; s < STEPS.length; s++) {
      const e = validate(s);
      if (Object.keys(e).length) {
        setErrors(e);
        setStep(s);
        scrollTop();
        return;
      }
    }
    setStatus("submitting");
    await submitWaiver(data);
    // Flip the onboarding waiver gate the coach sees, keyed to this dog.
    if (session?.dogId) {
      setWaiverSigned(session.dogId, {
        ownerName: `${data.firstName} ${data.lastName}`.trim() || session.ownerName,
        email: data.email,
        dogName: data.dogName || session.dogName,
      });
    }
    clearDraft();
    setStatus("success");
    scrollTop();
  }

  function startOver() {
    clearDraft();
    setData(emptyWaiver);
    setCompleted([]);
    setStep(0);
    setRestored(false);
    setErrors({});
  }

  if (status === "success") {
    return (
      <div ref={topRef} className="rounded-3xl bg-white/[0.04] p-8 text-center ring-1 ring-white/10">
        <CheckCircleIcon width={44} height={44} className="mx-auto text-accent" />
        <h2 className="display-heading mt-4 text-3xl text-paper">Waiver signed</h2>
        <p className="mx-auto mt-3 max-w-md text-paper/75">
          Thank you, {data.firstName || "there"} — your consent &amp; waiver for{" "}
          {data.dogName || "your dog"} is complete. That&apos;s the last step of
          onboarding; we&apos;ll confirm your place.
        </p>
        <div className="mt-6 flex justify-center">
          <Button href="/profile" radius="xl">
            Go to your profile
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={topRef}>
      {/* Progress */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">
          Step {step + 1} of {STEPS.length}
        </p>
        {saved && <span className="text-xs font-medium text-emerald-300">Draft saved ✓</span>}
      </div>
      <div
        className="mt-3 grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${STEPS.length}, 1fr)` }}
        aria-hidden="true"
      >
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`h-1.5 rounded-full ${i <= step || completed.includes(i) ? "bg-paper" : "bg-white/15"}`}
          />
        ))}
      </div>
      <h2 className="display-heading mt-6 text-2xl text-paper sm:text-3xl">{STEPS[step]}</h2>

      {restored && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/[0.05] p-4 text-sm ring-1 ring-white/10">
          <p className="text-paper/80">We saved your progress — carry on where you left off.</p>
          <button
            type="button"
            onClick={startOver}
            className="font-medium text-accent underline underline-offset-2"
          >
            Start over
          </button>
        </div>
      )}

      <div className="mt-5">
        {step === 0 && <AboutStep data={data} set={set} errors={errors} />}
        {step === 1 && <AddressStep data={data} set={set} errors={errors} />}
        {step === 2 && <DogBasicsStep data={data} set={set} errors={errors} />}
        {step === 3 && <VaccStep data={data} set={set} toggle={toggle} setData={setData} errors={errors} />}
        {step === 4 && <HealthStep data={data} set={set} errors={errors} />}
        {step === 5 && <VetStep data={data} set={set} errors={errors} />}
        {step === 6 && <AgreementStep data={data} toggle={toggle} errors={errors} />}
        {step === 7 && <SignStep data={data} set={set} errors={errors} onSign={() => setSigning(true)} />}
      </div>

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
            {status === "submitting" ? "Submitting…" : "Submit"}
          </Button>
        )}
      </div>

      {signing && (
        <SignaturePad
          onClose={() => setSigning(false)}
          onSave={(url) => {
            setData((d) => ({ ...d, signature: url }));
            setErrors((e) => ({ ...e, signature: "" }));
            setSigning(false);
          }}
        />
      )}
    </div>
  );
}

// --- shared bits ----------------------------------------------------------

type SetFn = (key: keyof WaiverData) => (value: string) => void;

function PhoneRow({
  label,
  codeKey,
  numberKey,
  data,
  set,
  error,
}: {
  label: string;
  codeKey: keyof WaiverData;
  numberKey: keyof WaiverData;
  data: WaiverData;
  set: SetFn;
  error?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-paper/90">
        {label} <span className="text-paper-dim">*</span>
      </label>
      <div className="flex gap-2">
        <div className="relative">
          <select
            value={String(data[codeKey])}
            onChange={(e) => set(codeKey)(e.target.value)}
            className="appearance-none rounded-xl border border-white/15 bg-white/[0.04] py-3 pl-4 pr-9 text-paper focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            aria-label={`${label} country code`}
          >
            {dialCodes.map((c) => (
              <option key={c} value={c} className="bg-ink text-paper">
                {c}
              </option>
            ))}
          </select>
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-paper-dim">
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
              <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        <input
          type="tel"
          inputMode="tel"
          value={String(data[numberKey])}
          onChange={(e) => set(numberKey)(e.target.value)}
          aria-invalid={!!error}
          className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-paper placeholder:text-paper-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
      {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
    </div>
  );
}

function YesNo({
  label,
  field,
  data,
  set,
  error,
}: {
  label: string;
  field: keyof WaiverData;
  data: WaiverData;
  set: SetFn;
  error?: string;
}) {
  return (
    <div>
      <p className="mb-2 block text-sm font-medium text-paper/90">
        {label} <span className="text-paper-dim">*</span>
      </p>
      <SelectCards ariaLabel={label} columns={2} options={yesNo} value={String(data[field])} onChange={set(field)} />
      {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
    </div>
  );
}

function Checkbox({
  checked,
  onToggle,
  children,
  error,
}: {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div>
      <button type="button" onClick={onToggle} aria-pressed={checked} className="flex w-full items-start gap-3 text-left">
        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
            checked ? "border-accent bg-accent text-accent-ink" : "border-white/30"
          }`}
        >
          {checked && <CheckIcon width={15} height={15} />}
        </span>
        <span className="text-sm text-paper/85">{children}</span>
      </button>
      {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
    </div>
  );
}

// --- steps ----------------------------------------------------------------

function AboutStep({ data, set, errors }: { data: WaiverData; set: SetFn; errors: Record<string, string> }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" name="firstName" required value={data.firstName} onChange={set("firstName")} error={errors.firstName} />
        <Field label="Last name" name="lastName" required value={data.lastName} onChange={set("lastName")} error={errors.lastName} />
      </div>
      <Field label="Email" name="email" type="email" inputMode="email" required value={data.email} onChange={set("email")} error={errors.email} placeholder="you@example.com" />
      <PhoneRow label="Emergency Contact 1" codeKey="em1Code" numberKey="em1" data={data} set={set} error={errors.em1} />
      <PhoneRow label="Emergency Contact 2" codeKey="em2Code" numberKey="em2" data={data} set={set} error={errors.em2} />
      <p className="-mt-1 text-sm text-paper-dim">
        Two emergency contact numbers we can use during our services, if required.
      </p>
    </div>
  );
}

function AddressStep({ data, set, errors }: { data: WaiverData; set: SetFn; errors: Record<string, string> }) {
  return (
    <div className="grid gap-4">
      <Field label="Country/Region" name="country" required value={data.country} onChange={set("country")} error={errors.country} options={countryOptions} />
      <Field label="Address" name="address" required value={data.address} onChange={set("address")} error={errors.address} placeholder="Street address" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City" name="city" required value={data.city} onChange={set("city")} error={errors.city} />
        <Field label="Zip / Postal code" name="postcode" required value={data.postcode} onChange={set("postcode")} error={errors.postcode} />
      </div>
    </div>
  );
}

function DogBasicsStep({ data, set, errors }: { data: WaiverData; set: SetFn; errors: Record<string, string> }) {
  return (
    <div className="grid gap-4">
      <Field label="Full Name" name="dogName" required value={data.dogName} onChange={set("dogName")} error={errors.dogName} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Breed" name="breed" required value={data.breed} onChange={set("breed")} error={errors.breed} />
        <Field label="Age" name="age" required value={data.age} onChange={set("age")} error={errors.age} placeholder="e.g. 2 yrs" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Gender" name="gender" required value={data.gender} onChange={set("gender")} error={errors.gender} options={genderOptions} />
        <Field label="Microchip Number" name="microchip" required value={data.microchip} onChange={set("microchip")} error={errors.microchip} />
      </div>
    </div>
  );
}

function VaccStep({
  data,
  set,
  toggle,
  setData,
  errors,
}: {
  data: WaiverData;
  set: SetFn;
  toggle: (key: keyof WaiverData) => void;
  setData: React.Dispatch<React.SetStateAction<WaiverData>>;
  errors: Record<string, string>;
}) {
  return (
    <div className="grid gap-4">
      <div>
        <p className="mb-2 block text-sm font-medium text-paper/90">
          Upload Vaccination Record <span className="text-paper-dim">*</span>
        </p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-sm font-medium text-paper transition-colors hover:border-white/40">
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => setData((d) => ({ ...d, vaccFile: e.target.files?.[0]?.name ?? "" }))}
          />
          {data.vaccFile ? "Change file" : "+ Upload File"}
        </label>
        {data.vaccFile && <p className="mt-2 text-sm text-paper/70">{data.vaccFile}</p>}
        {errors.vaccFile && <p className="mt-1.5 text-sm text-red-400">{errors.vaccFile}</p>}
      </div>

      <Checkbox checked={data.vaccConfirmed} onToggle={() => toggle("vaccConfirmed")} error={errors.vaccConfirmed}>
        I confirm vaccinations are up to date.
      </Checkbox>

      <YesNo label="Does your dog receive Kennel Cough vaccinations?" field="kennelCough" data={data} set={set} error={errors.kennelCough} />
    </div>
  );
}

function HealthStep({ data, set, errors }: { data: WaiverData; set: SetFn; errors: Record<string, string> }) {
  return (
    <div className="grid gap-4">
      <YesNo label="Medical Conditions" field="medical" data={data} set={set} error={errors.medical} />
      {data.medical === "yes" && (
        <Field label="Please give details" name="medicalDetails" required textarea rows={2} value={data.medicalDetails} onChange={set("medicalDetails")} error={errors.medicalDetails} />
      )}
      <YesNo label="Allergies" field="allergies" data={data} set={set} error={errors.allergies} />
      {data.allergies === "yes" && (
        <Field label="Please give details" name="allergyDetails" required textarea rows={2} value={data.allergyDetails} onChange={set("allergyDetails")} error={errors.allergyDetails} />
      )}
    </div>
  );
}

function VetStep({ data, set, errors }: { data: WaiverData; set: SetFn; errors: Record<string, string> }) {
  return (
    <div className="grid gap-4">
      <Field label="Vet's Name" name="vetName" required value={data.vetName} onChange={set("vetName")} error={errors.vetName} />
      <PhoneRow label="Vet's Contact Number" codeKey="vetCode" numberKey="vetPhone" data={data} set={set} error={errors.vetPhone} />
      <Field label="Vet's Address" name="vetAddress" required value={data.vetAddress} onChange={set("vetAddress")} error={errors.vetAddress} />
    </div>
  );
}

function AgreementStep({
  data,
  toggle,
  errors,
}: {
  data: WaiverData;
  toggle: (key: keyof WaiverData) => void;
  errors: Record<string, string>;
}) {
  return (
    <div>
      <h3 className="display-heading text-xl text-paper">{waiverTitle}</h3>
      <div className="mt-4 max-h-[46vh] overflow-y-auto rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
        <div className="space-y-5">
          {waiverClauses.map((c) => (
            <div key={c.heading}>
              <p className="font-semibold text-paper">{c.heading}</p>
              {c.lead && <p className="mt-1.5 text-sm text-paper/75">{c.lead}</p>}
              {c.bullets && (
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-paper/75 marker:text-paper-dim">
                  {c.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
              {c.note && <p className="mt-1.5 text-sm text-paper/75">{c.note}</p>}
              {c.body && <p className="mt-1.5 text-sm text-paper/75">{c.body}</p>}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5">
        <Checkbox checked={data.agreed} onToggle={() => toggle("agreed")} error={errors.agreed}>
          {waiverAgreement}
        </Checkbox>
      </div>
    </div>
  );
}

function SignStep({
  data,
  set,
  errors,
  onSign,
}: {
  data: WaiverData;
  set: SetFn;
  errors: Record<string, string>;
  onSign: () => void;
}) {
  return (
    <div className="grid gap-4">
      <Field label="The Client (Full Name)" name="clientName" required value={data.clientName} onChange={set("clientName")} error={errors.clientName} />
      <Field label="Date" name="signDate" type="date" required value={data.signDate} onChange={set("signDate")} error={errors.signDate} />
      <div>
        <p className="mb-2 block text-sm font-medium text-paper/90">
          Client Signature <span className="text-paper-dim">*</span>
        </p>
        {data.signature ? (
          <div className="rounded-2xl border border-white/15 bg-white/[0.06] p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.signature} alt="Your signature" className="mx-auto h-24 object-contain" />
            <div className="mt-2 text-center">
              <button type="button" onClick={onSign} className="text-sm font-medium text-accent underline underline-offset-2">
                Sign again
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onSign}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-sm font-medium text-accent transition-colors hover:border-white/40"
          >
            ✎ Click to Sign
          </button>
        )}
        {errors.signature && <p className="mt-1.5 text-sm text-red-400">{errors.signature}</p>}
      </div>
    </div>
  );
}
