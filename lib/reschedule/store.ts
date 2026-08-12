"use client";

/**
 * Reschedule requests (scaffold — localStorage).
 * ----------------------------------------------
 * The shared store the member's sessions view writes to and the admin's
 * requests queue reads, so a submitted request shows up for staff and an
 * approved one moves the member's session. Client-only stand-in for
 * lib/reschedule/data.ts, which the backend will persist.
 */
import { useSyncExternalStore } from "react";
import { submitReschedule, decideReschedule } from "./data";
import type { RescheduleRequest, RescheduleStatus } from "./types";

const EMPTY: RescheduleRequest[] = [];
const KEY = "nn-reschedule";
const EVENT = "nn-reschedule-change";

function read(): RescheduleRequest[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as RescheduleRequest[];
  } catch {
    return EMPTY;
  }
}

function write(list: RescheduleRequest[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVENT));
}

/** Member submits a request (upserts by session — one pending move per session). */
export function createReschedule(req: RescheduleRequest) {
  const list = read().filter((r) => !(r.dogId === req.dogId && r.sessionDate === req.sessionDate));
  write([req, ...list]);
  void submitReschedule(req);
}

/** Admin decides — approve / reject, optionally editing the target day/date. */
export function decide(
  id: string,
  status: RescheduleStatus,
  patch: Partial<Pick<RescheduleRequest, "toDay" | "toDate">> = {}
) {
  write(read().map((r) => (r.id === id ? { ...r, ...patch, status } : r)));
  void decideReschedule(id, status, patch);
}

/** Approved moves for a dog, keyed by the original session date. */
export function exceptionsFor(
  list: RescheduleRequest[],
  dogId: string
): Record<string, RescheduleRequest> {
  const out: Record<string, RescheduleRequest> = {};
  for (const r of list) {
    if (r.dogId === dogId && r.status === "approved") out[r.sessionDate] = r;
  }
  return out;
}

/** Pending request per session date (for a dog) — drives "requested" badges. */
export function pendingFor(
  list: RescheduleRequest[],
  dogId: string
): Record<string, RescheduleRequest> {
  const out: Record<string, RescheduleRequest> = {};
  for (const r of list) {
    if (r.dogId === dogId && r.status === "pending") out[r.sessionDate] = r;
  }
  return out;
}

// --- store wiring for useSyncExternalStore --------------------------------
let cache: RescheduleRequest[] = EMPTY;
let cacheRaw: string | null | undefined = undefined;

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): RescheduleRequest[] {
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

function getServerSnapshot(): RescheduleRequest[] {
  return EMPTY;
}

export function useReschedules(): RescheduleRequest[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
