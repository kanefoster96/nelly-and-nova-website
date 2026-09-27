/**
 * Customer records as stored in Supabase (see
 * supabase/migrations/20260926000000_customer_records.sql).
 */

export type AccountProfile = {
  id: string;
  role: "member" | "admin";
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postcode: string;
  country: string;
  emergencyContact1: string;
  emergencyContact2: string;
  avatarUrl: string | null;
  createdAt: string | null;
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
  createdAt: string | null;
};

/** Fields a customer (or trainer) can edit on a dog. */
export type DogPatch = Partial<Omit<DogRecord, "id" | "accountId" | "createdAt" | "waiverSignedAt">>;

export type DocumentKind = "vaccination" | "waiver" | "insurance" | "vet" | "other";

export const DOCUMENT_KINDS: { value: DocumentKind; label: string }[] = [
  { value: "vaccination", label: "Vaccination record" },
  { value: "insurance", label: "Insurance" },
  { value: "vet", label: "Vet letter / records" },
  { value: "other", label: "Other" },
];

export type DogDocument = {
  id: string;
  accountId: string;
  dogId: string | null;
  kind: DocumentKind;
  path: string;
  fileName: string;
  contentType: string;
  createdAt: string;
};

export type WaiverRecord = {
  id: string;
  accountId: string;
  dogId: string | null;
  signedName: string;
  signedAt: string;
  signaturePath: string | null;
  answers: Record<string, unknown>;
};

export type EnquiryStatus = "new" | "meet_greet_booked" | "onboarding" | "closed";

export const ENQUIRY_STATUSES: { value: EnquiryStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "meet_greet_booked", label: "Meet & greet booked" },
  { value: "onboarding", label: "Onboarding" },
  { value: "closed", label: "Closed" },
];

export type Enquiry = {
  id: string;
  kind: "contact" | "booking";
  status: EnquiryStatus;
  name: string;
  email: string;
  phone: string;
  message: string;
  service: string;
  dogNames: string;
  details: Record<string, unknown>;
  meetGreetAt: string | null;
  meetGreetNotes: string;
  accountId: string | null;
  createdAt: string;
};

/** "2 yrs" / "7 months" from a date of birth. */
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
