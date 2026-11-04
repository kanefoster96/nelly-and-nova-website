import { base64ToBytes } from "@/lib/base64";
import { supabase } from "@/lib/supabase";

/**
 * The owner's own records in the app: My Info, a dog's record, its
 * documents and signed forms. The same reads and writes as the website's
 * lib/records/client.ts (same tables, columns, storage buckets and paths),
 * so whatever is saved here shows the same on the website for owners and
 * trainers. Row Level Security keeps each owner to their own account and
 * dogs. Every function throws an Error with a friendly message.
 */

export const PHOTO_BUCKET = "dog-photos";
export const DOCUMENT_BUCKET = "dog-documents";
const MAX_BYTES = 10 * 1024 * 1024;

export type MyProfile = {
  id: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postcode: string;
  country: string;
  emergencyContact1: string;
  emergencyContact2: string;
};

export type DogRecord = {
  id: string;
  accountId: string;
  name: string;
  photoUrl: string | null;
  breed: string;
  sex: string;
  dateOfBirth: string; // YYYY-MM-DD or ""
  microchip: string;
  vaccinationsConfirmed: boolean;
  kennelCough: boolean | null;
  medicalConditions: string;
  allergies: string;
  vetName: string;
  vetPhone: string;
  vetAddress: string;
  notes: string;
  waiverSignedAt: string | null;
};

export type DogPatch = Partial<Omit<DogRecord, "id" | "accountId" | "waiverSignedAt">>;

export type DocumentKind = "vaccination" | "waiver" | "insurance" | "vet" | "other";
export const DOCUMENT_KINDS: { value: DocumentKind; label: string }[] = [
  { value: "vaccination", label: "Vaccination record" },
  { value: "insurance", label: "Insurance" },
  { value: "vet", label: "Vet letter / records" },
  { value: "other", label: "Other" },
];

export type DogDocument = { id: string; dogId: string | null; kind: DocumentKind; path: string; fileName: string; contentType: string; createdAt: string };
export type WaiverRecord = { id: string; signedName: string; signedAt: string; signaturePath: string | null };

/** A file picked on the phone, ready to upload. */
export type PickedFile = { uri: string; name: string; mimeType: string; size?: number | null };

/* eslint-disable @typescript-eslint/no-explicit-any */
const str = (v: any) => (typeof v === "string" ? v : v == null ? "" : String(v));

function fail(what: string, error: { message?: string } | null): never {
  const msg = error?.message ?? "";
  if (/row-level security|permission denied/i.test(msg)) throw new Error(`${what}: you don't have permission to do that.`);
  throw new Error(`${what}. ${msg || "Please try again."}`.trim());
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Please sign in again.");
  return data.user.id;
}

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "file";
}

// --- My Info -----------------------------------------------------------------

export async function getMyProfile(): Promise<MyProfile> {
  const id = await currentUserId();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, owner_name, email, phone, address, city, postcode, country, emergency_contact_1, emergency_contact_2")
    .eq("id", id)
    .single();
  if (error) fail("Couldn't load your details", error);
  return {
    id: data.id as string,
    ownerName: str(data.owner_name),
    email: str(data.email),
    phone: str(data.phone),
    address: str(data.address),
    city: str(data.city),
    postcode: str(data.postcode),
    country: str(data.country),
    emergencyContact1: str(data.emergency_contact_1),
    emergencyContact2: str(data.emergency_contact_2),
  };
}

const PROFILE_MAP: Record<string, string> = {
  ownerName: "owner_name",
  phone: "phone",
  address: "address",
  city: "city",
  postcode: "postcode",
  country: "country",
  emergencyContact1: "emergency_contact_1",
  emergencyContact2: "emergency_contact_2",
};

/** Saves only the fields given; empty becomes null, and the name is never cleared. */
export async function saveMyProfile(p: Partial<Omit<MyProfile, "id" | "email">>): Promise<void> {
  const id = await currentUserId();
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) if (PROFILE_MAP[k]) row[PROFILE_MAP[k]] = typeof v === "string" ? v.trim() || null : v;
  if (row.owner_name === null) delete row.owner_name;
  const { error } = await supabase.from("profiles").update(row).eq("id", id);
  if (error) fail("Couldn't save your details", error);
}

/**
 * Your own photo (owners and trainers): the public `media` bucket, in your
 * own folder, as the website's Team page stores trainers' photos, then
 * profiles.avatar_url — what chat, community and the top bar show.
 */
export async function uploadMyAvatar(file: PickedFile): Promise<string> {
  const id = await currentUserId();
  const bytes = await fileBytes(file);
  const type = file.mimeType === "image/png" ? "image/png" : "image/jpeg";
  const path = `${id}/avatar-${Date.now()}.${type === "image/png" ? "png" : "jpg"}`;
  const { error } = await supabase.storage.from("media").upload(path, bytes, { contentType: type, upsert: true });
  if (error) fail("Couldn't upload that photo", error);
  const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
  const { error: saveError } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", id);
  if (saveError) fail("Couldn't save your photo", saveError);
  return url;
}

export async function removeMyAvatar(): Promise<void> {
  const id = await currentUserId();
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", id);
  if (error) fail("Couldn't remove your photo", error);
}

// --- Dogs ----------------------------------------------------------------------

const DOG_COLUMNS =
  "id, account_id, name, photo_url, breed, sex, date_of_birth, microchip, vaccinations_confirmed, kennel_cough, medical_conditions, allergies, vet_name, vet_phone, vet_address, notes, waiver_signed_at";

function toDog(r: any): DogRecord {
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
  };
}

const DOG_MAP: Record<string, string> = {
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

/** The website's dogPatchToRow: only the columns given, empty strings as null, a dog keeps its name. */
function dogRow(p: DogPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    const col = DOG_MAP[k];
    if (!col) continue;
    row[col] = typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v;
  }
  if (row.name === null) delete row.name;
  return row;
}

export async function getMyDogRecords(): Promise<DogRecord[]> {
  const id = await currentUserId();
  const { data, error } = await supabase.from("dogs").select(DOG_COLUMNS).eq("account_id", id).order("sort_order").order("created_at");
  if (error) fail("Couldn't load your dogs", error);
  return (data ?? []).map(toDog);
}

/** One of the owner's own dogs (null if it isn't theirs). */
export async function getMyDog(dogId: string): Promise<DogRecord | null> {
  const id = await currentUserId();
  const { data, error } = await supabase.from("dogs").select(DOG_COLUMNS).eq("id", dogId).eq("account_id", id).maybeSingle();
  if (error) fail("Couldn't load this dog", error);
  return data ? toDog(data) : null;
}

export async function saveDog(dogId: string, patch: DogPatch): Promise<void> {
  const { error } = await supabase.from("dogs").update(dogRow(patch)).eq("id", dogId);
  if (error) fail("Couldn't save the dog's details", error);
}

export async function createDog(patch: DogPatch & { name: string }): Promise<DogRecord> {
  const owner = await currentUserId();
  const { data, error } = await supabase.from("dogs").insert({ ...dogRow(patch), account_id: owner }).select(DOG_COLUMNS).single();
  if (error) fail("Couldn't add the dog", error);
  return toDog(data);
}

async function fileBytes(file: PickedFile): Promise<ArrayBuffer> {
  const res = await fetch(file.uri);
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) throw new Error("That file is over 10 MB — please choose a smaller one.");
  return bytes;
}

/** A new photo for the dog: public dog-photos bucket, saved on the dog (as the website's uploadDogPhoto). */
export async function uploadDogPhoto(dog: Pick<DogRecord, "id" | "accountId">, file: PickedFile): Promise<string> {
  const bytes = await fileBytes(file);
  const ext = file.mimeType === "image/png" ? "png" : "jpg";
  const path = `${dog.accountId}/${dog.id}/photo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: file.mimeType || "image/jpeg", upsert: true });
  if (error) fail("Couldn't upload the photo", error);
  const url = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
  await saveDog(dog.id, { photoUrl: url });
  return url;
}

// --- Documents -------------------------------------------------------------------

function toDocument(r: any): DogDocument {
  return {
    id: r.id,
    dogId: r.dog_id ?? null,
    kind: r.kind,
    path: r.path,
    fileName: str(r.file_name) || str(r.path).split("/").pop() || "File",
    contentType: str(r.content_type),
    createdAt: r.created_at,
  };
}

export async function listDocuments(dogId: string): Promise<DogDocument[]> {
  const { data, error } = await supabase.from("dog_documents").select("*").eq("dog_id", dogId).order("created_at", { ascending: false });
  if (error) fail("Couldn't load documents", error);
  return (data ?? []).map(toDocument);
}

/**
 * Upload to the private documents bucket at the website's paths:
 * <account>/<dog or "pending">/<time>-<name>. With `record` and a dog it's
 * listed on the dog straight away; otherwise the caller attaches it later.
 */
export async function uploadDocument(
  file: PickedFile | { bytes: Uint8Array | ArrayBuffer; name: string; mimeType: string },
  opts: { kind: DocumentKind; dogId?: string | null; record?: boolean }
): Promise<{ path: string; fileName: string; contentType: string }> {
  const owner = await currentUserId();
  const bytes = "bytes" in file ? file.bytes : await fileBytes(file);
  if (bytes.byteLength > MAX_BYTES) throw new Error("That file is over 10 MB — please choose a smaller one.");
  const fileName = file.name || `${opts.kind}.bin`;
  const contentType = file.mimeType || "application/octet-stream";
  const path = `${owner}/${opts.dogId ?? "pending"}/${Date.now()}-${slug(fileName)}`;
  const { error } = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, bytes, { contentType });
  if (error) fail("Couldn't upload the file", error);
  if (opts.record && opts.dogId) await attachDocument({ path, fileName, contentType, kind: opts.kind, dogId: opts.dogId });
  return { path, fileName, contentType };
}

export async function attachDocument(d: { path: string; fileName: string; contentType: string; kind: DocumentKind; dogId: string }): Promise<void> {
  const owner = await currentUserId();
  const { error } = await supabase
    .from("dog_documents")
    .insert({ account_id: owner, dog_id: d.dogId, kind: d.kind, path: d.path, file_name: d.fileName, content_type: d.contentType });
  if (error) fail("Couldn't save the document", error);
}

export async function deleteDocument(doc: DogDocument): Promise<void> {
  await supabase.storage.from(DOCUMENT_BUCKET).remove([doc.path]);
  const { error } = await supabase.from("dog_documents").delete().eq("id", doc.id);
  if (error) fail("Couldn't delete the document", error);
}

/** A short-lived link to open a private file. */
export async function documentLink(path: string, seconds = 300): Promise<string> {
  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(path, seconds);
  if (error || !data) fail("Couldn't open the file", error);
  return data.signedUrl;
}

// --- Signed forms --------------------------------------------------------------

export async function listWaivers(dogId: string): Promise<WaiverRecord[]> {
  const { data, error } = await supabase.from("waivers").select("id, signed_name, signed_at, signature_path").eq("dog_id", dogId).order("signed_at", { ascending: false });
  if (error) fail("Couldn't load signed forms", error);
  return (data ?? []).map((r: any) => ({ id: r.id, signedName: str(r.signed_name), signedAt: r.signed_at, signaturePath: r.signature_path ?? null }));
}

/** The signature drawn on the form: a PNG in the private bucket, at the website's path. */
export async function uploadSignature(dataUrl: string, dogId: string): Promise<string> {
  const up = await uploadDocument({ bytes: base64ToBytes(dataUrl), name: "signature.png", mimeType: "image/png" }, { kind: "waiver", dogId, record: false });
  return up.path;
}

/** Record a signed consent & waiver and mark the dog signed (the website's signWaiver). */
export async function signWaiver(w: { dogId: string; signedName: string; signaturePath: string | null; answers: Record<string, unknown> }): Promise<void> {
  const accountId = await currentUserId();
  const signedAt = new Date().toISOString();
  const { error } = await supabase.from("waivers").insert({
    account_id: accountId,
    dog_id: w.dogId,
    signed_name: w.signedName,
    signed_at: signedAt,
    signature_path: w.signaturePath,
    answers: w.answers,
  });
  if (error) fail("Couldn't save the signed form", error);
  const { error: dogErr } = await supabase.from("dogs").update({ waiver_signed_at: signedAt }).eq("id", w.dogId);
  if (dogErr) fail("Couldn't update the dog", dogErr);
}

/** "2 yrs" / "7 months" from a date of birth (the website's ageFromDob). */
export function ageFromDob(dob: string, now = new Date()): string {
  if (!dob) return "";
  const d = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months -= 1;
  if (months < 0) return "";
  if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;
  const years = Math.floor(months / 12);
  return `${years} yr${years === 1 ? "" : "s"}`;
}

/**
 * "Download your data" in the app: the same export as the website's
 * /account/your-data/download (UK GDPR right of access), read with the
 * owner's own session so Row Level Security keeps it to their records.
 */
export async function exportMyData(): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error("Please sign in again.");
  const take = async (table: string, column = "account_id") => {
    const { data, error } = await supabase.from(table).select("*").eq(column, user.id);
    return error ? [] : (data ?? []);
  };
  const { data: conversation } = await supabase.from("conversations").select("id").eq("account_id", user.id).maybeSingle();
  const { data: messages } = conversation
    ? await supabase.from("messages").select("created_at, sender_is_staff, sender_name, body, attachment_name").eq("conversation_id", conversation.id).order("created_at")
    : { data: [] };
  const { data: meetGreet } = await supabase.rpc("nn_my_meet_greet");
  const exportData = {
    exportedAt: new Date().toISOString(),
    account: { email: user.email, createdAt: user.created_at },
    profile: (await take("profiles", "id"))[0] ?? null,
    dogs: await take("dogs"),
    dogDocuments: await take("dog_documents"),
    waivers: await take("waivers"),
    trainingPlaces: await take("placements"),
    bookings: await take("bookings"),
    directDebits: ((await take("payment_mandates")) as { status: string; created_at: string }[]).map((m) => ({ status: m.status, createdAt: m.created_at })),
    meetGreetRequest: meetGreet ?? null,
    chat: messages ?? [],
  };
  return JSON.stringify(exportData, null, 2);
}
