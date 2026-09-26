"use client";

/**
 * Browser drafts for multi-step forms. Each "Next" saves the form so someone
 * can close the tab and pick up where they left off. Storage can be full or
 * disabled (private browsing) — every call fails quietly and the form still
 * works, it just won't remember.
 */

export function loadFormDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Returns false if the draft couldn't be saved (e.g. storage full). */
export function saveFormDraft<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearFormDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
