import type { AccountProfile, DogDocument, DogPatch, DogRecord, Enquiry, WaiverRecord } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const str = (v: any) => (typeof v === "string" ? v : v == null ? "" : String(v));

export const PROFILE_COLUMNS =
  "id, role, owner_name, email, phone, address, city, postcode, country, emergency_contact_1, emergency_contact_2, avatar_url, created_at";

export function toProfile(r: any): AccountProfile {
  return {
    id: r.id,
    role: r.role === "admin" ? "admin" : "member",
    ownerName: str(r.owner_name),
    email: str(r.email),
    phone: str(r.phone),
    address: str(r.address),
    city: str(r.city),
    postcode: str(r.postcode),
    country: str(r.country),
    emergencyContact1: str(r.emergency_contact_1),
    emergencyContact2: str(r.emergency_contact_2),
    avatarUrl: r.avatar_url ?? null,
    createdAt: r.created_at ?? null,
  };
}

export const DOG_COLUMNS =
  "id, account_id, name, photo_url, breed, sex, date_of_birth, microchip, vaccinations_confirmed, kennel_cough, medical_conditions, allergies, vet_name, vet_phone, vet_address, notes, waiver_signed_at, created_at";

export function toDog(r: any): DogRecord {
  return {
    id: r.id,
    accountId: r.account_id,
    name: str(r.name),
    photoUrl: r.photo_url ?? null,
    breed: str(r.breed),
    sex: str(r.sex),
    dateOfBirth: str(r.date_of_birth),
    microchip: str(r.microchip),
    vaccinationsConfirmed: !!r.vaccinations_confirmed,
    kennelCough: r.kennel_cough ?? null,
    medicalConditions: str(r.medical_conditions),
    allergies: str(r.allergies),
    vetName: str(r.vet_name),
    vetPhone: str(r.vet_phone),
    vetAddress: str(r.vet_address),
    notes: str(r.notes),
    waiverSignedAt: r.waiver_signed_at ?? null,
    createdAt: r.created_at ?? null,
  };
}

/** Only the columns present in the patch, with empty strings saved as null. */
export function dogPatchToRow(p: DogPatch): Record<string, unknown> {
  const map: Record<string, string> = {
    name: "name",
    photoUrl: "photo_url",
    breed: "breed",
    sex: "sex",
    dateOfBirth: "date_of_birth",
    microchip: "microchip",
    vaccinationsConfirmed: "vaccinations_confirmed",
    kennelCough: "kennel_cough",
    medicalConditions: "medical_conditions",
    allergies: "allergies",
    vetName: "vet_name",
    vetPhone: "vet_phone",
    vetAddress: "vet_address",
    notes: "notes",
  };
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    const col = map[k];
    if (!col) continue;
    row[col] = typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v;
  }
  if (row.name === null) delete row.name; // a dog always keeps a name
  return row;
}

export function toDocument(r: any): DogDocument {
  return {
    id: r.id,
    accountId: r.account_id,
    dogId: r.dog_id ?? null,
    kind: r.kind,
    path: r.path,
    fileName: str(r.file_name) || str(r.path).split("/").pop() || "File",
    contentType: str(r.content_type),
    createdAt: r.created_at,
  };
}

export function toWaiver(r: any): WaiverRecord {
  return {
    id: r.id,
    accountId: r.account_id,
    dogId: r.dog_id ?? null,
    signedName: str(r.signed_name),
    signedAt: r.signed_at,
    signaturePath: r.signature_path ?? null,
    answers: (r.answers as Record<string, unknown>) ?? {},
  };
}

export function toEnquiry(r: any): Enquiry {
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    name: str(r.name),
    email: str(r.email),
    phone: str(r.phone),
    message: str(r.message),
    service: str(r.service),
    dogNames: str(r.dog_names),
    details: (r.details as Record<string, unknown>) ?? {},
    meetGreetAt: r.meet_greet_at ?? null,
    meetGreetNotes: str(r.meet_greet_notes),
    accountId: r.account_id ?? null,
    createdAt: r.created_at,
  };
}
