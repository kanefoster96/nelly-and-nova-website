"use client";

/**
 * Cancelled member accounts (scaffold — localStorage).
 * ----------------------------------------------------
 * Client-only stand-in for lib/members/data.ts → cancelAccount. Cancelling a
 * member also releases their schedule slot (lib/schedule/allocations.ts), the
 * same way the backend will, so the freed space shows up on the schedule.
 * Member id == the dog's id in the admin views.
 */
import { useSyncExternalStore } from "react";
import { cancelAccount as apiCancel } from "./data";
import { releaseSlot } from "@/lib/schedule/allocations";

const KEY = "nn-member-cancellations";
const EVENT = "nn-member-cancellations-change";
const EMPTY: string[] = [];

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return EMPTY;
  }
}

/** Cancel a member: mark cancelled, stop payments (seam), free their slot. */
export function cancelMember(memberId: string) {
  const next = Array.from(new Set([...read(), memberId]));
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
  void apiCancel(memberId); // backend seam (TODO)
  releaseSlot(memberId); // free their schedule slot
}

// --- store wiring for useSyncExternalStore --------------------------------
let cache: string[] = EMPTY;
let cacheRaw: string | null | undefined = undefined;

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): string[] {
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

function getServerSnapshot(): string[] {
  return EMPTY;
}

export function useCancellations(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
