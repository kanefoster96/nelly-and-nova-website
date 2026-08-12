"use client";

/**
 * Waiver draft persistence (scaffold — localStorage).
 * ---------------------------------------------------
 * Saves the form after each completed step so the customer can leave and come
 * back later without losing progress. On the backend this becomes a
 * `waiver_drafts` row keyed to the account (autosaved server-side).
 */

export type WaiverData = {
  // Owner details
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
  // Dog details
  dogName: string;
  breed: string;
  age: string;
  dob: string; // date of birth (YYYY-MM-DD) — captured on the waiver
  gender: string;
  microchip: string;
  vaccFile: string;
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
  // Consent
  agreed: boolean;
  clientName: string;
  signDate: string;
  signature: string; // data URL
};

export const emptyWaiver: WaiverData = {
  firstName: "", lastName: "", email: "", em1Code: "+44", em1: "", em2Code: "+44", em2: "",
  country: "", address: "", city: "", postcode: "",
  dogName: "", breed: "", age: "", dob: "", gender: "", microchip: "", vaccFile: "", vaccConfirmed: false,
  kennelCough: "", medical: "", medicalDetails: "", allergies: "", allergyDetails: "",
  vetName: "", vetCode: "+44", vetPhone: "", vetAddress: "",
  agreed: false, clientName: "", signDate: "", signature: "",
};

// v2: step layout changed (long steps split into shorter parts).
const KEY = "nn-waiver-draft-v2";

export type WaiverDraft = { step: number; completed: number[]; data: WaiverData };

export function loadDraft(): WaiverDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WaiverDraft;
    return { step: parsed.step ?? 0, completed: parsed.completed ?? [], data: { ...emptyWaiver, ...parsed.data } };
  } catch {
    return null;
  }
}

export function saveDraft(draft: WaiverDraft) {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota / disabled storage */
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
