"use client";

/**
 * Browser-side reads and writes for customer records. Row Level Security
 * decides what each call can see: a customer gets their own account and dogs,
 * a trainer (profiles.role = 'admin') gets everyone's. Every function throws
 * a friendly Error on failure so screens can show it.
 */
import { createClient } from "@/lib/supabase/client";
import {
  DOG_COLUMNS,
  PROFILE_COLUMNS,
  dogPatchToRow,
  toDocument,
  toDog,
  toEnquiry,
  toProfile,
  toWaiver,
} from "./mappers";
import type {
  AccountProfile,
  DocumentKind,
  DogDocument,
  DogPatch,
  DogRecord,
  Enquiry,
  EnquiryStatus,
  WaiverRecord,
} from "./types";

export const PHOTO_BUCKET = "dog-photos";
export const DOCUMENT_BUCKET = "dog-documents";

function sb() {
  return createClient();
}

/** Turn a Supabase error into a message a customer can act on. */
function fail(what: string, error: { message?: string; code?: string } | null): never {
  const msg = error?.message ?? "";
  if (/relation .* does not exist|column .* does not exist|schema cache/i.test(msg)) {
    throw new Error(`${what}: the database isn't set up yet (run the Supabase migration).`);
  }
  if (/row-level security|permission denied/i.test(msg)) {
    throw new Error(`${what}: you don't have permission to do that.`);
  }
  throw new Error(`${what}. ${msg || "Please try again."}`.trim());
}

async function currentUserId(): Promise<string> {
  const {
    data: { user },
  } = await sb().auth.getUser();
  if (!user) throw new Error("Please log in first.");
  return user.id;
}

/** Safe file name for storage paths. */
function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "file";
}

// --- account ---------------------------------------------------------------

export async function getMyProfile(): Promise<AccountProfile> {
  const id = await currentUserId();
  const { data, error } = await sb().from("profiles").select(PROFILE_COLUMNS).eq("id", id).single();
  if (error) fail("Couldn't load your details", error);
  return toProfile(data);
}

export async function saveProfile(
  id: string,
  p: Partial<Omit<AccountProfile, "id" | "role" | "avatarUrl" | "createdAt" | "email">>
): Promise<void> {
  const row: Record<string, unknown> = {};
  const map: Record<string, string> = {
    ownerName: "owner_name",
    phone: "phone",
    address: "address",
    city: "city",
    postcode: "postcode",
    country: "country",
    emergencyContact1: "emergency_contact_1",
    emergencyContact2: "emergency_contact_2",
  };
  for (const [k, v] of Object.entries(p)) {
    if (map[k]) row[map[k]] = typeof v === "string" ? v.trim() || null : v;
  }
  if (row.owner_name === null) delete row.owner_name;
  const { error } = await sb().from("profiles").update(row).eq("id", id);
  if (error) fail("Couldn't save the details", error);
}

// --- dogs ------------------------------------------------------------------

export async function getMyDogs(): Promise<DogRecord[]> {
  const id = await currentUserId();
  const { data, error } = await sb().from("dogs").select(DOG_COLUMNS).eq("account_id", id).order("sort_order").order("created_at");
  if (error) fail("Couldn't load your dogs", error);
  return (data ?? []).map(toDog);
}

export async function getDog(dogId: string): Promise<DogRecord | null> {
  const { data, error } = await sb().from("dogs").select(DOG_COLUMNS).eq("id", dogId).maybeSingle();
  if (error) fail("Couldn't load this dog", error);
  return data ? toDog(data) : null;
}

export async function saveDog(dogId: string, patch: DogPatch): Promise<void> {
  const { error } = await sb().from("dogs").update(dogPatchToRow(patch)).eq("id", dogId);
  if (error) fail("Couldn't save the dog's details", error);
}

/** Add a dog to the signed-in account (or, for a trainer, to `accountId`). */
export async function createDog(patch: DogPatch & { name: string }, accountId?: string): Promise<DogRecord> {
  const owner = accountId ?? (await currentUserId());
  const { data, error } = await sb()
    .from("dogs")
    .insert({ ...dogPatchToRow(patch), account_id: owner })
    .select(DOG_COLUMNS)
    .single();
  if (error) fail("Couldn't add the dog", error);
  return toDog(data);
}

/** Upload a dog's photo (a data URL from AvatarUpload) and save it on the dog. */
export async function uploadDogPhoto(dog: Pick<DogRecord, "id" | "accountId">, dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const ext = blob.type === "image/png" ? "png" : "jpg";
  const path = `${dog.accountId}/${dog.id}/photo-${Date.now()}.${ext}`;
  const { error } = await sb().storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: blob.type, upsert: true });
  if (error) fail("Couldn't upload the photo", error);
  const url = sb().storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
  await saveDog(dog.id, { photoUrl: url });
  return url;
}

// --- documents -------------------------------------------------------------

export async function listDocuments(filter: { dogId?: string; accountId?: string }): Promise<DogDocument[]> {
  let q = sb().from("dog_documents").select("*").order("created_at", { ascending: false });
  if (filter.dogId) q = q.eq("dog_id", filter.dogId);
  if (filter.accountId) q = q.eq("account_id", filter.accountId);
  const { data, error } = await q;
  if (error) fail("Couldn't load documents", error);
  return (data ?? []).map(toDocument);
}

/**
 * Upload a file to the private documents bucket. With a dogId the file is
 * recorded against that dog straight away; without one (e.g. mid-waiver,
 * before the dog exists) it goes to a "pending" folder and the caller links
 * it later with `attachDocument`.
 */
export async function uploadDocument(
  file: Blob & { name?: string },
  opts: { kind: DocumentKind; dogId?: string | null; accountId?: string; record?: boolean }
): Promise<DogDocument | { path: string; fileName: string; contentType: string }> {
  if (file.size > 10 * 1024 * 1024) throw new Error("That file is over 10 MB — please choose a smaller one.");
  const owner = opts.accountId ?? (await currentUserId());
  const fileName = file.name || `${opts.kind}.bin`;
  const path = `${owner}/${opts.dogId ?? "pending"}/${Date.now()}-${slug(fileName)}`;
  const { error } = await sb().storage.from(DOCUMENT_BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
  });
  if (error) fail("Couldn't upload the file", error);
  if (opts.record === false || !opts.dogId) return { path, fileName, contentType: file.type };
  return attachDocument({ path, fileName, contentType: file.type, kind: opts.kind, dogId: opts.dogId, accountId: owner });
}

/** Record an uploaded file against a dog. */
export async function attachDocument(d: {
  path: string;
  fileName: string;
  contentType: string;
  kind: DocumentKind;
  dogId: string;
  accountId: string;
}): Promise<DogDocument> {
  const { data, error } = await sb()
    .from("dog_documents")
    .insert({ account_id: d.accountId, dog_id: d.dogId, kind: d.kind, path: d.path, file_name: d.fileName, content_type: d.contentType })
    .select("*")
    .single();
  if (error) fail("Couldn't save the document", error);
  return toDocument(data);
}

export async function deleteDocument(doc: DogDocument): Promise<void> {
  await sb().storage.from(DOCUMENT_BUCKET).remove([doc.path]);
  const { error } = await sb().from("dog_documents").delete().eq("id", doc.id);
  if (error) fail("Couldn't delete the document", error);
}

/** A short-lived link to open a private document. */
export async function documentLink(path: string, seconds = 300): Promise<string> {
  const { data, error } = await sb().storage.from(DOCUMENT_BUCKET).createSignedUrl(path, seconds);
  if (error || !data) fail("Couldn't open the file", error);
  return data.signedUrl;
}

// --- waivers ---------------------------------------------------------------

export async function listWaivers(filter: { dogId?: string; accountId?: string }): Promise<WaiverRecord[]> {
  let q = sb().from("waivers").select("*").order("signed_at", { ascending: false });
  if (filter.dogId) q = q.eq("dog_id", filter.dogId);
  if (filter.accountId) q = q.eq("account_id", filter.accountId);
  const { data, error } = await q;
  if (error) fail("Couldn't load signed forms", error);
  return (data ?? []).map(toWaiver);
}

// --- trainer views ---------------------------------------------------------

export type DogWithOwner = DogRecord & { owner: Pick<AccountProfile, "id" | "ownerName" | "email" | "phone"> | null };

/** Every dog with its owner's name and contact details (trainers only). */
export async function listAllDogs(): Promise<DogWithOwner[]> {
  const [dogsRes, profilesRes] = await Promise.all([
    sb().from("dogs").select(DOG_COLUMNS).order("name"),
    sb().from("profiles").select("id, owner_name, email, phone"),
  ]);
  if (dogsRes.error) fail("Couldn't load dogs", dogsRes.error);
  if (profilesRes.error) fail("Couldn't load owners", profilesRes.error);
  const owners = new Map(
    (profilesRes.data ?? []).map((p) => [p.id as string, { id: p.id as string, ownerName: (p.owner_name as string) ?? "", email: (p.email as string) ?? "", phone: (p.phone as string) ?? "" }])
  );
  return (dogsRes.data ?? []).map((r) => {
    const dog = toDog(r);
    return { ...dog, owner: owners.get(dog.accountId) ?? null };
  });
}

export type AccountWithDogs = AccountProfile & { dogs: Pick<DogRecord, "id" | "name" | "photoUrl" | "breed" | "waiverSignedAt">[] };

/** Every customer account with its dogs (trainers only). */
export async function listAccounts(): Promise<AccountWithDogs[]> {
  const [profilesRes, dogsRes] = await Promise.all([
    sb().from("profiles").select(PROFILE_COLUMNS).order("owner_name"),
    sb().from("dogs").select("id, account_id, name, photo_url, breed, waiver_signed_at").order("name"),
  ]);
  if (profilesRes.error) fail("Couldn't load accounts", profilesRes.error);
  if (dogsRes.error) fail("Couldn't load dogs", dogsRes.error);
  const byOwner = new Map<string, AccountWithDogs["dogs"]>();
  for (const d of dogsRes.data ?? []) {
    const list = byOwner.get(d.account_id as string) ?? [];
    list.push({ id: d.id as string, name: (d.name as string) ?? "", photoUrl: (d.photo_url as string) ?? null, breed: (d.breed as string) ?? "", waiverSignedAt: (d.waiver_signed_at as string) ?? null });
    byOwner.set(d.account_id as string, list);
  }
  return (profilesRes.data ?? []).map((r) => {
    const p = toProfile(r);
    return { ...p, dogs: byOwner.get(p.id) ?? [] };
  });
}

export async function getAccount(id: string): Promise<AccountProfile | null> {
  const { data, error } = await sb().from("profiles").select(PROFILE_COLUMNS).eq("id", id).maybeSingle();
  if (error) fail("Couldn't load the account", error);
  return data ? toProfile(data) : null;
}

export async function getAccountDogs(accountId: string): Promise<DogRecord[]> {
  const { data, error } = await sb().from("dogs").select(DOG_COLUMNS).eq("account_id", accountId).order("sort_order").order("created_at");
  if (error) fail("Couldn't load dogs", error);
  return (data ?? []).map(toDog);
}

// --- enquiries (trainer onboarding list) -----------------------------------

export async function listEnquiries(): Promise<Enquiry[]> {
  const { data, error } = await sb().from("enquiries").select("*").order("created_at", { ascending: false }).limit(500);
  if (error) fail("Couldn't load enquiries", error);
  return (data ?? []).map(toEnquiry);
}

export async function updateEnquiry(
  id: string,
  patch: { status?: EnquiryStatus; meetGreetAt?: string | null; meetGreetNotes?: string }
): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status) row.status = patch.status;
  if (patch.meetGreetAt !== undefined) row.meet_greet_at = patch.meetGreetAt;
  if (patch.meetGreetNotes !== undefined) row.meet_greet_notes = patch.meetGreetNotes.trim() || null;
  const { error } = await sb().from("enquiries").update(row).eq("id", id);
  if (error) fail("Couldn't update the enquiry", error);
}

/** Record a signed consent & waiver and mark the dog as signed. */
export async function signWaiver(w: {
  accountId: string;
  dogId: string;
  signedName: string;
  signaturePath: string | null;
  answers: Record<string, unknown>;
}): Promise<void> {
  const signedAt = new Date().toISOString();
  const { error } = await sb().from("waivers").insert({
    account_id: w.accountId,
    dog_id: w.dogId,
    signed_name: w.signedName,
    signed_at: signedAt,
    signature_path: w.signaturePath,
    answers: w.answers,
  });
  if (error) fail("Couldn't save the signed form", error);
  const { error: dogErr } = await sb().from("dogs").update({ waiver_signed_at: signedAt }).eq("id", w.dogId);
  if (dogErr) fail("Couldn't update the dog", dogErr);
}

/** The signed-in user's id (throws if signed out). */
export async function myAccountId(): Promise<string> {
  return currentUserId();
}
