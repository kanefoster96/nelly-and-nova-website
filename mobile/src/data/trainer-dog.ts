import { addressLine } from "@/lib/contact";
import { supabase } from "@/lib/supabase";

import { getDogSessions, type DogSession } from "./sessions";
import { addDays, todayISO, type Weekday } from "./trainer-schedule";

/**
 * Trainer: a dog's whole record, as the website's /admin/dogs/[id]
 * (components/dogs/DogRecordView.tsx) shows it: details and health from
 * `dogs`, the owner (contact details, address, emergency contacts) from
 * `profiles`, the signed consent & waiver (`waivers`, the signature in the
 * private dog-documents bucket), documents (`dog_documents`), regular
 * places and the coming sessions. Trainers pass Row Level Security on all
 * of it.
 */

const DOCUMENT_BUCKET = "dog-documents";

export type TrainerDogOwner = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  address: string | null;
  emergencyContacts: string[];
};

export type TrainerDog = {
  id: string;
  name: string;
  breed: string | null;
  sex: string | null;
  dateOfBirth: string | null;
  photoUrl: string | null;
  microchip: string | null;
  vaccinationsConfirmed: boolean | null;
  kennelCough: boolean | null;
  medicalConditions: string | null;
  allergies: string | null;
  /** The owner's "Anything else we should know?" (behaviour, quirks). */
  notes: string | null;
  vetName: string | null;
  vetPhone: string | null;
  vetAddress: string | null;
  waiverSignedAt: string | null;
  owner: TrainerDogOwner | null;
  places: { id: string; day: Weekday; cadence: "weekly" | "alternating"; startOn: string; endOn: string | null }[];
  /** The next sessions from today (regular days, one-offs and 1-1s), cancelled ones flagged. */
  upcoming: DogSession[];
  waiver: { signedName: string; signedAt: string; signatureUrl: string | null; answers: Record<string, unknown> } | null;
  documents: { id: string; kind: string; fileName: string; path: string; createdAt: string }[];
};

type DogRow = {
  id: string;
  name: string;
  breed: string | null;
  sex: string | null;
  date_of_birth: string | null;
  photo_url: string | null;
  microchip: string | null;
  vaccinations_confirmed: boolean | null;
  kennel_cough: boolean | null;
  medical_conditions: string | null;
  allergies: string | null;
  notes: string | null;
  vet_name: string | null;
  vet_phone: string | null;
  vet_address: string | null;
  waiver_signed_at: string | null;
  account_id: string | null;
};

type ProfileRow = {
  id: string;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  pickup_address: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
  emergency_contact_1: string | null;
  emergency_contact_2: string | null;
};

const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

export async function getTrainerDog(dogId: string): Promise<TrainerDog | null> {
  const { data, error } = await supabase
    .from("dogs")
    .select(
      "id, name, breed, sex, date_of_birth, photo_url, microchip, vaccinations_confirmed, kennel_cough, medical_conditions, allergies, notes, vet_name, vet_phone, vet_address, waiver_signed_at, account_id",
    )
    .eq("id", dogId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const d = data as DogRow;
  const today = todayISO();

  const [owner, places, upcoming, waivers, documents] = await Promise.all([
    d.account_id
      ? supabase
          .from("profiles")
          .select("id, owner_name, email, phone, avatar_url, pickup_address, address, city, postcode, emergency_contact_1, emergency_contact_2")
          .eq("id", d.account_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("placements").select("id, day, cadence, start_on, end_on").eq("dog_id", dogId).or(`end_on.is.null,end_on.gte.${today}`).order("start_on"),
    getDogSessions(dogId, today, addDays(today, 42)).catch(() => [] as DogSession[]),
    supabase.from("waivers").select("signed_name, signed_at, signature_path, answers").eq("dog_id", dogId).order("signed_at", { ascending: false }).limit(1),
    supabase.from("dog_documents").select("id, kind, file_name, path, created_at").eq("dog_id", dogId).neq("kind", "waiver").order("created_at", { ascending: false }),
  ]);

  const o = owner.data as ProfileRow | null;
  const w = ((waivers.data ?? []) as { signed_name: string | null; signed_at: string; signature_path: string | null; answers: Record<string, unknown> | null }[])[0];
  let signatureUrl: string | null = null;
  if (w?.signature_path) {
    const signed = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(w.signature_path, 600);
    signatureUrl = signed.data?.signedUrl ?? null;
  }
  const answers = w?.answers ?? {};
  const fromWaiver = [answers.emergencyContact1, answers.emergencyContact2].map((x) => (typeof x === "string" ? blank(x) : null));
  const emergency = [blank(o?.emergency_contact_1) ?? fromWaiver[0], blank(o?.emergency_contact_2) ?? fromWaiver[1]].filter((x): x is string => !!x);

  return {
    id: d.id,
    name: d.name,
    breed: blank(d.breed),
    sex: blank(d.sex),
    dateOfBirth: d.date_of_birth,
    photoUrl: d.photo_url,
    microchip: blank(d.microchip),
    vaccinationsConfirmed: d.vaccinations_confirmed,
    kennelCough: d.kennel_cough,
    medicalConditions: blank(d.medical_conditions),
    allergies: blank(d.allergies),
    notes: blank(d.notes),
    vetName: blank(d.vet_name),
    vetPhone: blank(d.vet_phone),
    vetAddress: blank(d.vet_address),
    waiverSignedAt: d.waiver_signed_at,
    owner: o
      ? {
          id: o.id,
          name: blank(o.owner_name),
          email: blank(o.email),
          phone: blank(o.phone),
          avatarUrl: o.avatar_url,
          address: addressLine(o),
          emergencyContacts: emergency,
        }
      : null,
    places: ((places.data ?? []) as { id: string; day: Weekday; cadence: "weekly" | "alternating"; start_on: string; end_on: string | null }[]).map((p) => ({
      id: p.id,
      day: p.day,
      cadence: p.cadence,
      startOn: p.start_on,
      endOn: p.end_on,
    })),
    upcoming: upcoming.slice(0, 8),
    waiver: w ? { signedName: w.signed_name ?? "", signedAt: w.signed_at, signatureUrl, answers } : null,
    documents: ((documents.data ?? []) as { id: string; kind: string; file_name: string | null; path: string; created_at: string }[]).map((x) => ({
      id: x.id,
      kind: x.kind,
      fileName: x.file_name || x.path.split("/").pop() || "File",
      path: x.path,
      createdAt: x.created_at,
    })),
  };
}

/** A short-lived link to a private document (a PDF or photo, opened in the browser). */
export async function documentLink(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(path, 300);
  if (error || !data) throw new Error("Couldn't open the file.");
  return data.signedUrl;
}

export const DOCUMENT_LABEL: Record<string, string> = {
  vaccination: "Vaccination record",
  insurance: "Insurance",
  vet: "Vet letter / records",
  other: "Document",
};
