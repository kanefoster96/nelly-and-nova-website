"use client";

/**
 * Tracks which report cards the owner has seen (scaffold — localStorage).
 * Drives the notification dot on the header avatar and the "New" badge on the
 * report-card button. Opening the report cards marks them seen.
 *
 * TODO(backend): replace with report_cards.seen_at and a Realtime subscription
 * so a newly published card lights the badge live.
 */
import { useSyncExternalStore } from "react";
import { newReportIds, newReportIdsForDog } from "./sample";
import { OUTBOX_EVENT, readOutboxNewIds } from "./outbox";

const KEY = "nn-reports-seen";
const EVENT = "nn-reports-seen-change";

function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/** Mark report cards as seen so their badges clear. */
export function markReportsSeen(ids: string[]) {
  const merged = Array.from(new Set([...readSeen(), ...ids]));
  localStorage.setItem(KEY, JSON.stringify(merged));
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener(OUTBOX_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener(OUTBOX_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Count unseen cards — for one dog if `dogId` is given, else across the account. */
function computeUnseen(dogId?: string): number {
  let seen: Set<string>;
  try {
    seen = new Set(readSeen());
  } catch {
    seen = new Set();
  }
  // Sample "new" cards plus any freshly-sent ones the owner hasn't seen.
  const sampleNew = dogId ? newReportIdsForDog(dogId) : newReportIds;
  const newIds = [...sampleNew, ...readOutboxNewIds(dogId)];
  return newIds.filter((id) => !seen.has(id)).length;
}

/** Number of unseen report cards (the snapshot is a stable-by-value number). */
export function useUnseenReportCount(dogId?: string): number {
  return useSyncExternalStore(
    subscribe,
    () => computeUnseen(dogId),
    () => 0
  );
}
