"use client";

/**
 * Per-session payment status (scaffold — localStorage).
 * -----------------------------------------------------
 * Keyed by `${dogId}:${date}`. With no backend, an unset session gets a stable
 * default (most paid, a few pending/failed) so the coach's schedule shows a
 * realistic mix; real status comes from GoCardless payment webhooks. Retrying
 * re-charges via the seam; the backend flips status on the webhook.
 */
import { useSyncExternalStore } from "react";
import { retryCharge } from "./data";
import type { PaymentStatus } from "./types";

type Store = Record<string, PaymentStatus>;
const EMPTY: Store = {};
const KEY = "nn-payments";
const EVENT = "nn-payments-change";

const keyOf = (dogId: string, date: string) => `${dogId}:${date}`;

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

/** Deterministic default so the demo shows a mix without seeding writes.
 *  Weighted toward paid — most recurring members are up to date. */
function defaultStatus(dogId: string): PaymentStatus {
  const h = [...dogId].reduce((n, c, i) => n + c.charCodeAt(0) * (i + 1), 0);
  if (h % 6 === 0) return "failed";
  if (h % 6 === 2) return "pending";
  return "paid";
}

export function getStatus(store: Store, dogId: string, date: string): PaymentStatus {
  return store[keyOf(dogId, date)] ?? defaultStatus(dogId);
}

export function setStatus(dogId: string, date: string, status: PaymentStatus) {
  write({ ...read(), [keyOf(dogId, date)]: status });
}

/** Retry a session's payment → pending until the webhook settles it. */
export function retryPayment(dogId: string, date: string) {
  setStatus(dogId, date, "pending");
  void retryCharge(dogId, date);
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

export function usePayments(): Store {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
