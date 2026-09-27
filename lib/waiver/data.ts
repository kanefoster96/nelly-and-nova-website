/**
 * Saving a signed Final Consent & Waiver to Supabase.
 *
 * On submit: the dog's record is created or updated from the answers, the
 * owner's address and emergency contacts are saved on their account, the
 * signature (PNG) and vaccination record go into the private dog-documents
 * bucket, and a `waivers` row is written (which marks the dog as signed).
 */
import type { WaiverData } from "./draft";
import {
  attachDocument,
  createDog,
  myAccountId,
  saveDog,
  saveProfile,
  signWaiver,
  uploadDocument,
} from "@/lib/records/client";
import type { DogPatch } from "@/lib/records/types";

const phone = (code: string, num: string) => (num.trim() ? `${code} ${num.trim()}` : "");

/** Returns the dog's id. Throws an Error with a friendly message on failure. */
export async function submitWaiver(data: WaiverData): Promise<string> {
  const accountId = await myAccountId();

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

  await saveProfile(accountId, {
    ownerName: `${data.firstName} ${data.lastName}`.trim(),
    address: data.address,
    city: data.city,
    postcode: data.postcode,
    country: data.country,
    emergencyContact1: phone(data.em1Code, data.em1),
    emergencyContact2: phone(data.em2Code, data.em2),
  });

  // Signature → private storage.
  let signaturePath: string | null = null;
  if (data.signature) {
    const blob = await (await fetch(data.signature)).blob();
    const file = new File([blob], "signature.png", { type: "image/png" });
    const up = await uploadDocument(file, { kind: "waiver", dogId, accountId, record: false });
    signaturePath = up.path;
  }

  // Vaccination record (uploaded when chosen) → attach it to the dog.
  if (data.vaccPath) {
    await attachDocument({
      path: data.vaccPath,
      fileName: data.vaccFile || "Vaccination record",
      contentType: data.vaccType,
      kind: "vaccination",
      dogId,
      accountId,
    });
  }

  const { signature: _sig, ...answers } = data;
  void _sig;
  await signWaiver({
    accountId,
    dogId,
    signedName: data.clientName.trim(),
    signaturePath,
    answers: {
      ...answers,
      emergencyContact1: phone(data.em1Code, data.em1),
      emergencyContact2: phone(data.em2Code, data.em2),
      vetPhone: phone(data.vetCode, data.vetPhone),
      agreedTo: "Training Consent & Waiver",
    },
  });

  return dogId;
}
