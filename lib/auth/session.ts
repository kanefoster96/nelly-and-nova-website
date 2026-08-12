"use client";

/**
 * Demo auth session (scaffold).
 * -----------------------------
 * There is no real auth yet, so a "signed-in" session is simulated in
 * localStorage and surfaced through a small store so the header (and any
 * other component) updates live when someone logs in or out.
 *
 * TODO(backend): replace signIn/signOut with Supabase auth and read the
 * session from supabase.auth.getSession() / onAuthStateChange(). The Session
 * shape below (owner + their dog as the account's main profile) maps to the
 * user's metadata + their primary dog profile row.
 */
import { useSyncExternalStore } from "react";

export type Role = "member" | "admin";

/** One dog on the account (the profile can switch between them). */
export type SessionDog = { id: string; name: string; photo: string };

export type Session = {
  ownerName: string;
  dogName: string;
  /** The dog's photo — used as the account picture in the header. */
  dogPhoto: string;
  /** The dog's id — links the account to its onboarding record + schedule slot. */
  dogId?: string;
  /** All dogs on the account. The active one is mirrored into dogName/Photo/Id. */
  dogs?: SessionDog[];
  role: Role;
};

const KEY = "nn-demo-session";
const EVENT = "nn-session-change";

/** Sample signed-in member, used by the scaffold login. */
export const SAMPLE_SESSION: Session = {
  ownerName: "Rachel T.",
  dogName: "Nova",
  dogPhoto: "/placeholders/dog-avatar-01.svg",
  dogId: "d-nova",
  // A two-dog account so the profile's dog-switcher is demonstrable.
  dogs: [
    { id: "d-nova", name: "Nova", photo: "/placeholders/dog-avatar-01.svg" },
    { id: "d-rex", name: "Rex", photo: "/placeholders/dog-avatar-02.svg" },
  ],
  role: "member",
};

/** Sample signed-in coach/admin. `ownerName` doubles as the coach's name. */
export const SAMPLE_ADMIN: Session = {
  ownerName: "Charlotte",
  dogName: "Trainer",
  dogPhoto: "/placeholders/icon-mark.svg",
  role: "admin",
};

function read(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function signIn(session: Session = SAMPLE_SESSION) {
  localStorage.setItem(KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(EVENT));
}

export function signOut() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

/** Switch the account's active dog — mirrors it into dogName/dogPhoto/dogId. */
export function setActiveDog(dogId: string) {
  const s = read();
  const dog = s?.dogs?.find((d) => d.id === dogId);
  if (!s || !dog) return;
  localStorage.setItem(
    KEY,
    JSON.stringify({ ...s, dogId: dog.id, dogName: dog.name, dogPhoto: dog.photo })
  );
  window.dispatchEvent(new Event(EVENT));
}

// --- store wiring for useSyncExternalStore -------------------------------
let cache: Session | null = null;
// `undefined` = not yet computed (distinct from localStorage's string | null).
let cacheRaw: string | null | undefined = undefined;

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): Session | null {
  // Re-parse only when the stored string changes, so the snapshot is stable
  // (returning a fresh object every call would loop useSyncExternalStore).
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

/** Server render (and the first client render) has no session. */
function getServerSnapshot(): Session | null {
  return null;
}

/** Subscribe a component to the demo session (null when signed out). */
export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
