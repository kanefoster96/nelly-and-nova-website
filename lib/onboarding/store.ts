"use client";

/**
 * Onboarding records (scaffold — localStorage).
 * ---------------------------------------------
 * The shared store the waiver form and the coach's schedule board both read and
 * write, so signing the waiver flips the same `waiverSigned` gate the coach
 * sees. Client-only stand-in for lib/onboarding/data.ts, which the backend will
 * persist. Keyed by dogId.
 */
import { useSyncExternalStore } from "react";
import { blankOnboarding, type OnboardingRecord } from "./types";
import {
  startOnboarding,
  markWaiverSigned as apiWaiver,
  setupPayment as apiPayment,
  confirmPlacement as apiConfirm,
} from "./data";

type Store = Record<string, OnboardingRecord>;
const EMPTY: Store = {};
const KEY = "nn-onboarding";
const EVENT = "nn-onboarding-change";

function read(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    return EMPTY;
  }
}

function write(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(EVENT));
}

function patch(dogId: string, changes: Partial<OnboardingRecord>): OnboardingRecord {
  const store = read();
  const cur = store[dogId] ?? blankOnboarding(dogId);
  const next = { ...cur, ...changes, dogId };
  write({ ...store, [dogId]: next });
  return next;
}

export function getOnboarding(dogId: string): OnboardingRecord | undefined {
  return read()[dogId];
}

/** Create/refresh a record when a coach holds a slot for a customer. */
export function startRecord(rec: OnboardingRecord) {
  patch(rec.dogId, rec);
  void startOnboarding(rec); // backend seam (TODO)
}

/** The customer signed the waiver (from /waiver). Upserts with their details. */
export function setWaiverSigned(dogId: string, info: Partial<OnboardingRecord> = {}) {
  patch(dogId, { ...info, waiverSigned: true });
  void apiWaiver(dogId); // backend seam (TODO)
}

/** Coach toggle for the waiver gate (e.g. a paper waiver signed in person). */
export function setWaiver(dogId: string, waiverSigned: boolean) {
  patch(dogId, { waiverSigned });
  if (waiverSigned) void apiWaiver(dogId); // backend seam (TODO)
}

/** Toggle the payment gate. When set true, kicks off the GoCardless mandate. */
export function setPaymentSet(dogId: string, paymentSet: boolean) {
  patch(dogId, { paymentSet });
  if (paymentSet) void apiPayment(dogId); // backend seam (TODO — GoCardless)
}

/** Confirm the placement with a first start date → status confirmed. */
export function confirmPlacement(dogId: string, startDate: string) {
  patch(dogId, { startDate, status: "confirmed" });
  void apiConfirm(dogId, startDate); // backend seam (TODO)
}

// --- store wiring for useSyncExternalStore --------------------------------
let cache: Store = EMPTY;
let cacheRaw: string | null | undefined = undefined;

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): Store {
  const raw = (() => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  })();
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cache = read();
  }
  return cache;
}

function getServerSnapshot(): Store {
  return EMPTY;
}

export function useOnboarding(): Store {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
