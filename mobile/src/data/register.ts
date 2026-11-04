import { config } from "@/lib/config";
import { supabase } from "@/lib/supabase";

import { attachDocument, createDog, saveDog, saveMyProfile, signWaiver, uploadSignature, type DogPatch } from "./my-records";

/**
 * Registering a dog in the app: the website's Final Consent & Waiver
 * (components/waiver/WaiverForm.tsx, lib/waiver/*) as a native form. Same
 * fields, the same checks on each step, and saved the same way, so a form
 * signed in the app is exactly what a trainer sees for one signed on the
 * website: the dog's record is created or updated from the answers, the
 * owner's address and emergency contacts go on their account, the
 * signature (a PNG, dark ink on white) and vaccination record go into the
 * private dog-documents bucket, a `waivers` row marks the dog signed, and
 * the trainers are told.
 */

export type WaiverData = {
  firstName: string;
  lastName: string;
  email: string;
  em1Code: string;
  em1: string;
  em2Code: string;
  em2: string;
  country: string;
  address: string;
  city: string;
  postcode: string;
  /** Which dog on the account this is for ("" = a new dog). */
  dogId: string;
  dogName: string;
  breed: string;
  age: string;
  dob: string; // YYYY-MM-DD
  gender: string;
  microchip: string;
  vaccFile: string;
  vaccPath: string;
  vaccType: string;
  vaccConfirmed: boolean;
  kennelCough: string;
  medical: string;
  medicalDetails: string;
  allergies: string;
  allergyDetails: string;
  vetName: string;
  vetCode: string;
  vetPhone: string;
  vetAddress: string;
  agreed: boolean;
  clientName: string;
  signDate: string;
  signature: string; // PNG data URL
};

export const emptyWaiver: WaiverData = {
  firstName: "", lastName: "", email: "", em1Code: "+44", em1: "", em2Code: "+44", em2: "",
  country: "", address: "", city: "", postcode: "",
  dogId: "", dogName: "", breed: "", age: "", dob: "", gender: "", microchip: "", vaccFile: "", vaccPath: "", vaccType: "", vaccConfirmed: false,
  kennelCough: "", medical: "", medicalDetails: "", allergies: "", allergyDetails: "",
  vetName: "", vetCode: "+44", vetPhone: "", vetAddress: "",
  agreed: false, clientName: "", signDate: "", signature: "",
};

/** The website's steps, split the same way, plus a check-everything step before signing. */
export const REGISTER_STEPS = [
  "About you",
  "Your address",
  "Dog’s details · basics",
  "Dog’s details · vaccinations",
  "Dog’s details · health",
  "Dog’s details · vet",
  "Consent & waiver",
  "Check your answers",
  "Sign & submit",
] as const;
export const REVIEW_STEP = 7;
export const SIGN_STEP = 8;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

/** The website's validate(), step for step (the check step has nothing to fill in). */
export function validateStep(s: number, data: WaiverData, uploading = false): Record<string, string> {
  const e: Record<string, string> = {};
  const req = (k: keyof WaiverData) => {
    if (!String(data[k] ?? "").trim()) e[k] = "Please fill this in.";
  };
  switch (s) {
    case 0:
      req("firstName"); req("lastName"); req("email"); req("em1"); req("em2");
      if (data.email && !EMAIL_RE.test(data.email.trim())) e.email = "Enter a valid email address.";
      break;
    case 1:
      req("country"); req("address"); req("city"); req("postcode");
      break;
    case 2:
      req("dogName"); req("breed"); req("dob"); req("gender"); req("microchip");
      if (data.dob && data.dob > todayISO()) e.dob = "Date of birth can't be in the future.";
      break;
    case 3:
      if (uploading) e.vaccFile = "Still uploading — one moment.";
      else if (!data.vaccPath) e.vaccFile = "Please upload the vaccination record.";
      if (!data.vaccConfirmed) e.vaccConfirmed = "Please confirm.";
      if (!data.kennelCough) e.kennelCough = "Please choose one.";
      break;
    case 4:
      if (!data.medical) e.medical = "Please choose one.";
      if (data.medical === "yes") req("medicalDetails");
      if (!data.allergies) e.allergies = "Please choose one.";
      if (data.allergies === "yes") req("allergyDetails");
      break;
    case 5:
      req("vetName"); req("vetPhone"); req("vetAddress");
      break;
    case 6:
      if (!data.agreed) e.agreed = "Please confirm you agree to the terms.";
      break;
    case SIGN_STEP:
      req("clientName");
      if (!data.signature) e.signature = "Please add your signature.";
      break;
  }
  return e;
}

// --- The draft on this phone ------------------------------------------------

export type RegisterDraft = { step: number; completed: number[]; data: WaiverData; dobText: string };

const draftKey = (userId: string, dogKey: string) => `nn-register-draft-v1:${userId}:${dogKey}`;

export function loadDraft(userId: string, dogKey: string): RegisterDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(userId, dogKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RegisterDraft>;
    return {
      step: Math.min(Math.max(0, parsed.step ?? 0), REGISTER_STEPS.length - 1),
      completed: parsed.completed ?? [],
      data: { ...emptyWaiver, ...(parsed.data ?? {}) },
      dobText: parsed.dobText ?? "",
    };
  } catch {
    return null;
  }
}

export function saveDraft(userId: string, dogKey: string, draft: RegisterDraft): void {
  try {
    localStorage.setItem(draftKey(userId, dogKey), JSON.stringify(draft));
  } catch {
    // A full or unavailable store only loses the draft.
  }
}

export function clearDraft(userId: string, dogKey: string): void {
  try {
    localStorage.removeItem(draftKey(userId, dogKey));
  } catch {
    // ignore
  }
}

// --- Filling in what we already know ------------------------------------------

/** "+44 07700 900123" → { code: "+44", number: "07700 900123" }. */
export function splitPhone(value: string, codes: string[]): { code: string; number: string } {
  const v = value.trim();
  const code = codes.find((c) => v.startsWith(`${c} `));
  return code ? { code, number: v.slice(code.length + 1) } : { code: "+44", number: v };
}

// --- Saving -----------------------------------------------------------------

const phone = (code: string, num: string) => (num.trim() ? `${code} ${num.trim()}` : "");

/** Push the notifications a change made (app/api/sessions/push). Best-effort. */
export async function pushNotices(notices: unknown): Promise<void> {
  if (!Array.isArray(notices) || notices.length === 0) return;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch(new URL("/api/sessions/push", config.siteUrl).toString(), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ notices }),
    });
  } catch {
    // The rows are saved either way; only the push is missed.
  }
}

/** The website's submitWaiver. Returns the dog's id; throws a friendly Error. */
export async function submitRegistration(data: WaiverData): Promise<string> {
  const dogPatch: DogPatch & { name: string } = {
    name: data.dogName.trim(),
    breed: data.breed,
    sex: data.gender,
    dateOfBirth: data.dob,
    microchip: data.microchip,
    vaccinationsConfirmed: data.vaccConfirmed,
    kennelCough: data.kennelCough === "" ? null : data.kennelCough === "yes",
    medicalConditions: data.medical === "yes" ? data.medicalDetails : "",
    allergies: data.allergies === "yes" ? data.allergyDetails : "",
    vetName: data.vetName,
    vetPhone: phone(data.vetCode, data.vetPhone),
    vetAddress: data.vetAddress,
  };

  let dogId = data.dogId;
  if (dogId) await saveDog(dogId, dogPatch);
  else dogId = (await createDog(dogPatch)).id;

  await saveMyProfile({
    ownerName: `${data.firstName} ${data.lastName}`.trim(),
    address: data.address,
    city: data.city,
    postcode: data.postcode,
    country: data.country,
    emergencyContact1: phone(data.em1Code, data.em1),
    emergencyContact2: phone(data.em2Code, data.em2),
  });

  const signaturePath = data.signature ? await uploadSignature(data.signature, dogId) : null;

  if (data.vaccPath) {
    await attachDocument({ path: data.vaccPath, fileName: data.vaccFile || "Vaccination record", contentType: data.vaccType, kind: "vaccination", dogId });
  }

  const { signature: _sig, ...answers } = data;
  void _sig;
  await signWaiver({
    dogId,
    signedName: data.clientName.trim(),
    signaturePath,
    answers: {
      ...answers,
      dogId,
      emergencyContact1: phone(data.em1Code, data.em1),
      emergencyContact2: phone(data.em2Code, data.em2),
      vetPhone: phone(data.vetCode, data.vetPhone),
      agreedTo: "Training Consent & Waiver",
      signedIn: "app",
    },
  });

  // Tell the trainers (once per signed form), and push it to their phones.
  try {
    const { data: notices } = await supabase.rpc("nn_waiver_notify_trainers", { p_dog_id: dogId });
    await pushNotices(notices);
  } catch {
    // Registered either way.
  }
  return dogId;
}
