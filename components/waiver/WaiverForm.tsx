"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectCards } from "@/components/ui/SelectCards";
import { CheckIcon, CheckCircleIcon, CalendarIcon } from "@/components/ui/Icons";
import { DraftRestored, StepCard, WizardHeading, WizardNav, WizardProgress } from "@/components/ui/WizardProgress";
import { useAuthStatus, useSession } from "@/lib/auth/session";
import { getDog, uploadDocument } from "@/lib/records/client";
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
  const authStatus = useAuthStatus();
  const [data, setData] = useState<WaiverData>(emptyWaiver);
  const [submitError, setSubmitError] = useState("");
  const [savedDogId, setSavedDogId] = useState("");
  const [vaccUploading, setVaccUploading] = useState(false);
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [restored, setRestored] = useState(false);
  const [saved, setSaved] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);

  // Restore a saved draft, or prefill from the signed-in account. Runs on mount
  // and again if the session arrives late; only fills fields still empty.
  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      const draft = loadDraft();
      if (draft) {
         
        setData(draft.data);
        setStep(Math.min(Math.max(0, draft.step), STEPS.length - 1));
        setCompleted(draft.completed);
        setRestored(true);
         
        return;
      }
    }
    if (session) {
      const [first, ...rest] = session.ownerName.split(" ");
      const today = new Date().toISOString().slice(0, 10);
      // "/waiver?dog=<id>" (from a dog's page) picks that dog up front.
      const fromLink = new URLSearchParams(window.location.search).get("dog") ?? "";
      const linked = session.dogs?.find((x) => x.id === fromLink);
      setData((d) => ({
        ...d,
        firstName: d.firstName || first || "",
        lastName: d.lastName || rest.join(" ") || "",
        clientName: d.clientName || session.ownerName || "",
        dogId: d.dogId || linked?.id || "",
        dogName: d.dogName || linked?.name || "",
        signDate: d.signDate || today,
      }));
    }
  }, [session]);

  /** Choose which dog on the account the form is for, and fill in what we know. */
  async function pickDog(id: string) {
    const name = session?.dogs?.find((x) => x.id === id)?.name ?? "";
    setData((d) => ({ ...d, dogId: id, dogName: id ? name || d.dogName : "" }));
    setErrors((e) => ({ ...e, dogName: "" }));
    if (!id) return;
    const dog = await getDog(id).catch(() => null);
    if (!dog) return;
    setData((d) => ({
      ...d,
      breed: d.breed || dog.breed,
      dob: d.dob || dog.dateOfBirth,
      gender: d.gender || (["Male", "Female"].find((g) => dog.sex.startsWith(g)) ?? ""),
      microchip: d.microchip || dog.microchip,
      vetName: d.vetName || dog.vetName,
      vetAddress: d.vetAddress || dog.vetAddress,
    }));
  }

  /** Upload the vaccination record as soon as it's chosen, so it survives the draft. */
  async function pickVaccFile(file: File) {
    setVaccUploading(true);
    setErrors((e) => ({ ...e, vaccFile: "" }));
    try {
      const up = await uploadDocument(file, { kind: "vaccination", record: false });
      setData((d) => ({ ...d, vaccFile: up.fileName, vaccPath: up.path, vaccType: up.contentType }));
    } catch (err) {
      setErrors((e) => ({ ...e, vaccFile: (err as Error).message }));
    } finally {
      setVaccUploading(false);
    }
  }

  // Also save if they leave mid-step (switch apps, close the tab), not just on Next.
  const latest = useRef({ step, completed, data, status });
  useEffect(() => {
    latest.current = { step, completed, data, status };
  }, [step, completed, data, status]);
  useEffect(() => {
    const onHide = () => {
      const l = latest.current;
      if (document.visibilityState === "hidden" && l.status === "idle") {
        saveDraft({ step: l.step, completed: l.completed, data: l.data });
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  const set = (key: keyof WaiverData) => (value: string) => {
    setData((d) => ({ ...d, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };
  const toggle = (key: keyof WaiverData) => {
    setData((d) => ({ ...d, [key]: !d[key] }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };

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
        req("dogName"); req("breed"); req("dob"); req("gender"); req("microchip");
        if (data.dob && data.dob > new Date().toISOString().slice(0, 10)) {
          e.dob = "Date of birth can't be in the future.";
        }
        break;
      case 3: // Vaccinations
        if (vaccUploading) e.vaccFile = "Still uploading — one moment.";
        else if (!data.vaccPath) e.vaccFile = "Please upload the vaccination record.";
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
        req("clientName");
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
    jump(Math.max(step - 1, 0));
  }

  /** Go straight to an earlier (or already-completed) step, saving first. */
  function jump(target: number) {
    setErrors({});
    setStep(target);
    persist(target, completed);
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
    setSubmitError("");
    // Stamp the signing date with the moment they click "Sign & submit",
    // rather than a date they picked by hand.
    const signedData = { ...data, signDate: new Date().toISOString().slice(0, 10) };
    setData(signedData);
    let dogId: string;
    try {
      dogId = await submitWaiver(signedData);
    } catch (err) {
      // Keep everything (the draft is still saved) so they can try again.
      setStatus("idle");
      setSubmitError((err as Error).message);
      persist(step, completed);
      return;
    }
    // Flip the onboarding waiver gate the coach sees, keyed to this dog.
    setWaiverSigned(dogId, {
      ownerName: `${data.firstName} ${data.lastName}`.trim() || session?.ownerName || "",
      email: data.email,
      dogName: data.dogName,
    });
    setSavedDogId(dogId);
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
      <div ref={topRef} className="rounded-2xl border border-white/10 bg-ink-soft p-8 text-center animate-fade-up">
        <CheckCircleIcon width={44} height={44} className="mx-auto text-accent" />
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-paper">Waiver signed</h2>
        <p className="mx-auto mt-3 max-w-md text-paper/75">
          Thank you, {data.firstName || "there"} — your consent &amp; waiver for{" "}
          {data.dogName || "your dog"} is saved to your account. We&apos;ll be in touch
          to confirm your place.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {savedDogId && (
            <Button href={`/profile/dogs/${savedDogId}`} radius="xl">
              View {data.dogName || "your dog"}&apos;s record
            </Button>
          )}
          <Button href="/profile" variant="secondary" radius="xl">
            Go to your profile
          </Button>
        </div>
      </div>
    );
  }

  if (authStatus === "loading") {
    return <div className="rounded-2xl border border-white/10 bg-ink-soft p-8 text-center text-paper-dim">Loading…</div>;
  }

  // The form is saved against the customer's account and dog, so it needs a login.
  if (authStatus === "anon") {
    return (
      <div className="rounded-2xl border border-white/10 bg-ink-soft p-8 text-center">
        <h2 className="text-2xl font-semibold text-paper">Log in to continue</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm text-paper-dim">
          Your consent &amp; waiver is saved to your account and your dog&apos;s record, so please log
          in (or create an account) first.{restored ? " Your progress so far is saved on this device." : ""}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button href="/login" radius="xl">Log in</Button>
          <Button href="/create-account" variant="secondary" radius="xl">Create an account</Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={topRef} tabIndex={-1} className="scroll-mt-24 outline-none">
      <WizardHeading title={STEPS[step]} step={step} total={STEPS.length} saved={saved} />
      <div className="mt-5">
        <WizardProgress
          steps={STEPS}
          current={step}
          reachable={(i) => i < step || completed.includes(i) || completed.includes(i - 1)}
          onJump={jump}
        />
      </div>

      {restored && <DraftRestored onStartOver={startOver} />}

      <StepCard key={step}>
        {step === 0 && <AboutStep data={data} set={set} errors={errors} />}
        {step === 1 && <AddressStep data={data} set={set} errors={errors} />}
        {step === 2 && (
          <DogBasicsStep data={data} set={set} errors={errors} dogs={session?.dogs ?? []} onPickDog={(id) => void pickDog(id)} />
        )}
        {step === 3 && (
          <VaccStep data={data} set={set} toggle={toggle} onFile={(f) => void pickVaccFile(f)} uploading={vaccUploading} errors={errors} />
        )}
        {step === 4 && <HealthStep data={data} set={set} errors={errors} />}
        {step === 5 && <VetStep data={data} set={set} errors={errors} />}
        {step === 6 && <AgreementStep data={data} toggle={toggle} errors={errors} />}
        {step === 7 && (
          <SignStep
            data={data}
            set={set}
            errors={errors}
            onSignature={(url) => {
              setData((d) => ({ ...d, signature: url }));
              if (url) setErrors((e) => ({ ...e, signature: "" }));
            }}
          />
        )}

        {submitError && (
          <p role="alert" className="mt-6 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            Couldn&apos;t submit: {submitError}
          </p>
        )}
        {Object.values(errors).some(Boolean) && (
          <p role="alert" className="mt-6 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            Please check the highlighted {Object.values(errors).filter(Boolean).length === 1 ? "field" : "fields"} above.
          </p>
        )}

        <WizardNav
          onBack={step > 0 ? back : undefined}
          onNext={step < STEPS.length - 1 ? next : submit}
          nextLabel={step < STEPS.length - 1 ? "Next" : "Sign & submit"}
          busy={status === "submitting"}
          busyLabel="Signing…"
        />
      </StepCard>
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
      <label className="mb-2 block text-sm text-paper-dim">
        {label} <span className="text-paper-dim/70">*</span>
      </label>
      <div className="flex gap-2">
        <div className="relative">
          <select
            value={String(data[codeKey])}
            onChange={(e) => set(codeKey)(e.target.value)}
            className="appearance-none rounded-lg border border-white/10 bg-ink py-2.5 pl-4 pr-9 text-sm text-paper outline-none transition-colors focus:border-white/40"
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
          className="w-full rounded-lg border border-white/10 bg-ink px-4 py-2.5 text-sm text-paper placeholder:text-paper-dim/70 outline-none transition-colors focus:border-white/40 aria-[invalid=true]:border-red-400/60"
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
      <p className="mb-2 block text-sm text-paper-dim">
        {label} <span className="text-paper-dim/70">*</span>
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
            checked ? "border-accent bg-accent text-accent-ink" : "border-white/25 bg-ink"
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

function DogBasicsStep({
  data,
  set,
  errors,
  dogs,
  onPickDog,
}: {
  data: WaiverData;
  set: SetFn;
  errors: Record<string, string>;
  dogs: { id: string; name: string }[];
  onPickDog: (id: string) => void;
}) {
  return (
    <div className="grid gap-4">
      {dogs.length > 0 && (
        <div>
          <p className="mb-2 block text-sm text-paper-dim">Which dog is this for?</p>
          <SelectCards
            ariaLabel="Which dog is this for?"
            options={[...dogs.map((d) => ({ value: d.id, label: d.name })), { value: "", label: "Another dog" }]}
            value={data.dogId}
            onChange={onPickDog}
          />
        </div>
      )}
      <Field label="Dog's full name" name="dogName" required value={data.dogName} onChange={set("dogName")} error={errors.dogName} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Breed" name="breed" required value={data.breed} onChange={set("breed")} error={errors.breed} />
        <Field label="Date of birth" name="dob" type="date" required value={data.dob} onChange={set("dob")} error={errors.dob} />
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
  onFile,
  uploading,
  errors,
}: {
  data: WaiverData;
  set: SetFn;
  toggle: (key: keyof WaiverData) => void;
  onFile: (file: File) => void;
  uploading: boolean;
  errors: Record<string, string>;
}) {
  return (
    <div className="grid gap-4">
      <div>
        <p className="mb-2 block text-sm text-paper-dim">
          Upload Vaccination Record <span className="text-paper-dim/70">*</span>
        </p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-sm font-medium text-paper transition-colors hover:border-white/40">
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onFile(file);
            }}
          />
          {uploading ? "Uploading…" : data.vaccPath ? "Change file" : "+ Upload File"}
        </label>
        {data.vaccPath && !uploading && <p className="mt-2 text-sm text-emerald-300">{data.vaccFile} ✓ uploaded</p>}
        <p className="mt-1.5 text-xs text-paper-dim">A photo or PDF, up to 10 MB. Kept privately on your account.</p>
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
      <h3 className="text-lg font-semibold text-paper">{waiverTitle}</h3>
      <div className="mt-4 max-h-[46vh] overflow-y-auto overscroll-contain rounded-lg border border-white/10 bg-ink p-5">
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

function formatSignDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function SignStep({
  data,
  set,
  errors,
  onSignature,
}: {
  data: WaiverData;
  set: SetFn;
  errors: Record<string, string>;
  onSignature: (dataUrl: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <p className="text-sm text-paper">To be signed by the dog&apos;s owner, who must be 18 or over.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="The Client (Full Name)" name="clientName" required value={data.clientName} onChange={set("clientName")} error={errors.clientName} />
        <div>
          <p className="mb-2 block text-sm text-paper-dim">Date signed</p>
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-ink px-4 py-2.5 text-sm text-paper-dim">
            <CalendarIcon width={16} height={16} className="shrink-0" />
            <span>{formatSignDate(new Date().toISOString().slice(0, 10))}</span>
          </div>
        </div>
      </div>
      <div>
        <p className="mb-2 block text-sm text-paper-dim">
          Client signature <span className="text-paper-dim/70">*</span>
        </p>
        <SignaturePad value={data.signature} onChange={onSignature} invalid={!!errors.signature} />
        {errors.signature && <p className="mt-1.5 text-sm text-red-400">{errors.signature}</p>}
      </div>
    </div>
  );
}
