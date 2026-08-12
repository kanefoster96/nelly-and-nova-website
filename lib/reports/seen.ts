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
import { newReportIds } from "./sample";
import { OUTBOX_EVENT, OUTBOX_KEY, readOutboxNewIds } from "./outbox";

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

let cache = 0;
// `undefined` = not yet computed (distinct from localStorage's string | null).
let cacheRaw: string | null | undefined = undefined;

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

function getSnapshot(): number {
  // Recompute when either the seen set or the sent-cards outbox changes.
  const raw = (() => {
    try {
      return `${localStorage.getItem(KEY)}|${localStorage.getItem(OUTBOX_KEY)}`;
    } catch {
      return null;
    }
  })();
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    const seen = new Set(readSeen());
    // Sample "new" cards plus any freshly-sent ones the owner hasn't seen.
    const newIds = [...newReportIds, ...readOutboxNewIds()];
    cache = newIds.filter((id) => !seen.has(id)).length;
  }
  return cache;
}

/** Server (and first hydration render) show no badge; it lights after mount. */
function getServerSnapshot(): number {
  return 0;
}

/** Number of unseen report cards. */
export function useUnseenReportCount(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
