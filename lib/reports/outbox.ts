"use client";

/**
 * Sent report cards (scaffold — localStorage).
 * --------------------------------------------
 * When a coach sends the day's report cards from the dashboard, each one is
 * written here. The owner's report list (components/ReportCards.tsx) merges
 * these in, and the header notification badge (lib/reports/seen.ts) counts the
 * unseen ones — so a card a coach sends shows up for the owner straight away.
 *
 * This is the client-only stand-in for what the backend seam
 * (lib/reports/data.ts → sendReportCards) will do server-side: insert
 * `report_cards` rows and a "new report card" notification per owner, delivered
 * live over Realtime instead of localStorage.
 */
import { useSyncExternalStore } from "react";
import type { ReportCard } from "./types";

export const OUTBOX_KEY = "nn-reports-outbox";
export const OUTBOX_EVENT = "nn-reports-outbox-change";

function read(): ReportCard[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]") as ReportCard[];
  } catch {
    return [];
  }
}

/** Append sent cards, replacing any earlier card with the same id. */
export function sendToOutbox(cards: ReportCard[]) {
  const byId = new Map(read().map((c) => [c.id, c]));
  for (const c of cards) byId.set(c.id, c);
  localStorage.setItem(OUTBOX_KEY, JSON.stringify([...byId.values()]));
  window.dispatchEvent(new Event(OUTBOX_EVENT));
}

/** Ids of sent cards still marked new — feeds the unseen badge count.
 *  Pass a dogId to count only that dog's cards. */
export function readOutboxNewIds(dogId?: string): string[] {
  return read()
    .filter((c) => c.isNew && (!dogId || c.dogId === dogId))
    .map((c) => c.id);
}

// --- store wiring for useSyncExternalStore --------------------------------
const EMPTY: ReportCard[] = [];
let cache: ReportCard[] = EMPTY;
let cacheRaw: string | null | undefined = undefined;

function subscribe(cb: () => void) {
  window.addEventListener(OUTBOX_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(OUTBOX_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): ReportCard[] {
  const raw = (() => {
    try {
      return localStorage.getItem(OUTBOX_KEY);
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

/** Server (and first hydration render) show nothing; cards appear after mount. */
function getServerSnapshot(): ReportCard[] {
  return EMPTY;
}

/** Sent report cards, newest first. */
export function useOutboxCards(): ReportCard[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
