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
import { chargeForSession } from "@/lib/payments/data";
import type { RescheduleRequest, RescheduleStatus } from "./types";
import type { DayId } from "@/lib/schedule/types";

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

/**
 * Coach one-off move from the calendar — records an already-approved move so it
 * shows on the member's sessions and the day view immediately (no request step).
 */
export function moveSession(move: {
  dogId: string;
  dogName: string;
  ownerName: string;
  fromDate: string;
  fromDay: DayId;
  toDate: string;
  toDay: DayId;
}) {
  const req: RescheduleRequest = {
    id: `mv-${move.dogId}-${move.fromDate}`,
    kind: "reschedule",
    dogId: move.dogId,
    dogName: move.dogName,
    ownerName: move.ownerName,
    sessionDate: move.fromDate,
    fromDay: move.fromDay,
    toDay: move.toDay,
    toDate: move.toDate,
    note: "Moved by trainer",
    status: "approved",
    createdAt: new Date().toISOString(),
  };
  const list = read().filter((r) => !(r.dogId === req.dogId && r.sessionDate === req.sessionDate));
  write([req, ...list]);
  void submitReschedule(req);
}

/** Add a one-off session for a customer on a single date (no recurring slot). */
export function addOneOff(o: {
  dogId: string;
  dogName: string;
  ownerName: string;
  date: string;
  day: DayId;
}) {
  const req: RescheduleRequest = {
    id: `oneoff-${o.dogId}-${o.date}`,
    kind: "extra",
    dogId: o.dogId,
    dogName: o.dogName,
    ownerName: o.ownerName,
    sessionDate: o.date,
    fromDay: o.day,
    toDay: o.day,
    toDate: o.date,
    note: "One-off session",
    status: "approved",
    createdAt: new Date().toISOString(),
  };
  const list = read().filter((r) => r.id !== req.id);
  write([req, ...list]);
  void submitReschedule(req);
}

/** Approving an extra session charges the customer via GoCardless. */
function chargeIfExtra(req: RescheduleRequest | undefined) {
  if (req?.kind === "extra") {
    void chargeForSession(req.dogId, { reason: "Extra session", service: req.service });
  }
}

/** Admin decides — approve / reject, optionally editing the target day/date. */
export function decide(
  id: string,
  status: RescheduleStatus,
  patch: Partial<Pick<RescheduleRequest, "toDay" | "toDate">> = {}
) {
  const list = read();
  const req = list.find((r) => r.id === id);
  write(list.map((r) => (r.id === id ? { ...r, ...patch, status } : r)));
  void decideReschedule(id, status, patch);
  if (status === "approved") chargeIfExtra(req);
}

/** Admin offers the member a different date (member can accept). */
export function suggest(id: string, toDay: DayId, toDate: string) {
  write(read().map((r) => (r.id === id ? { ...r, toDay, toDate, status: "suggested" } : r)));
  void decideReschedule(id, "suggested" as RescheduleStatus, { toDay, toDate });
}

/** Member accepts the admin's suggested date → approved (+ charge if extra). */
export function acceptSuggestion(id: string) {
  const req = read().find((r) => r.id === id);
  write(read().map((r) => (r.id === id ? { ...r, status: "approved" } : r)));
  void decideReschedule(id, "approved");
  chargeIfExtra(req);
}

/** Requests with an admin-suggested alternative, keyed by original session. */
export function suggestedFor(
  list: RescheduleRequest[],
  dogId: string
): Record<string, RescheduleRequest> {
  const out: Record<string, RescheduleRequest> = {};
  for (const r of list) {
    if (r.dogId === dogId && r.status === "suggested") out[r.sessionDate] = r;
  }
  return out;
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
