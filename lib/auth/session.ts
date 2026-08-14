"use client";

/**
 * Auth session, backed by Supabase.
 * ---------------------------------
 * The signed-in account is sourced from Supabase auth plus the account's
 * `profiles` row (role, owner name, avatar) and its `dogs`. The rich `Session`
 * shape below is kept stable so the rest of the app reads it exactly as before;
 * only the source changed (Supabase, not a simulated localStorage session).
 *
 * `useSession()` returns the account (or null); `useAuthStatus()` distinguishes
 * "loading" from "anon" so gates don't flash logged-out while auth resolves.
 */
import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type Role = "member" | "admin";
export type AuthStatus = "loading" | "authed" | "anon";

/** One dog on the account (the profile can switch between them). */
export type SessionDog = { id: string; name: string; photo: string };

export type Session = {
  ownerName: string;
  dogName: string;
  /** The active dog's photo — used as the account picture in the header. */
  dogPhoto: string;
  /** The active dog's id — links the account to its records + schedule slot. */
  dogId?: string;
  /** All dogs on the account. The active one is mirrored into dogName/Photo/Id. */
  dogs?: SessionDog[];
  /** A joint photo for the whole account — overrides the dog photo as the
   * account avatar (community, header). */
  accountPhoto?: string;
  role: Role;
};

/** Dog details a new account can bring through sign-up. */
export type SignUpDog = { name: string; breed?: string };

const ACTIVE_DOG_KEY = "nn-active-dog";

// --- helpers (unchanged; operate on a Session) ----------------------------

/** Join names naturally: "Nova", "Nova & Rex", "Nova, Rex & Bella". */
export function joinNames(names: string[]): string {
  const list = names.filter(Boolean);
  if (list.length <= 1) return list[0] ?? "";
  return `${list.slice(0, -1).join(", ")} & ${list[list.length - 1]}`;
}

/**
 * How the account is shown to others — in the community and in chat with the
 * business. An account is known by its dogs, so this joins every dog's name
 * ("Nova & Rex"), falling back to the active dog, then the owner's name.
 */
export function accountDisplayName(session: Session | null): string {
  if (!session) return "";
  const names = (session.dogs ?? []).map((d) => d.name);
  return joinNames(names) || session.dogName || session.ownerName;
}

/**
 * How staff see an account in chat — the owner's name with their dog(s) in
 * brackets, e.g. "Rachel T. (Nova & Rex)".
 */
export function accountAdminLabel(session: Session | null): string {
  if (!session) return "";
  const dogs = joinNames((session.dogs ?? []).map((d) => d.name)) || session.dogName;
  return dogs ? `${session.ownerName} (${dogs})` : session.ownerName;
}

/** The account's avatar — the joint photo if one's been set, else the dog's. */
export function accountAvatar(session: Session | null): string {
  if (!session) return "";
  return session.accountPhoto || session.dogPhoto;
}

// --- store state ----------------------------------------------------------

let status: AuthStatus = "loading";
let session: Session | null = null;
let activeDogId: string | null = null;
let initialized = false;

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

let _client: SupabaseClient | null = null;
function sb(): SupabaseClient {
  _client ??= createClient();
  return _client;
}

function readActiveDog(): string | null {
  try {
    return localStorage.getItem(ACTIVE_DOG_KEY);
  } catch {
    return null;
  }
}

/** Mirror the chosen dog into the flat dogName/dogPhoto/dogId fields. */
function withActiveDog(base: Session, dogs: SessionDog[]): Session {
  const active = dogs.find((d) => d.id === activeDogId) ?? dogs[0] ?? null;
  activeDogId = active?.id ?? null;
  return {
    ...base,
    dogs,
    dogId: active?.id,
    dogName: active?.name ?? "",
    dogPhoto: active?.photo ?? "",
  };
}

/** Rebuild the Session from the current Supabase user + profile + dogs. */
async function hydrate() {
  let user: User | null = null;
  try {
    ({
      data: { user },
    } = await sb().auth.getUser());
  } catch {
    // Network/auth failure — fall back to signed-out rather than hang loading.
    status = "anon";
    session = null;
    emit();
    return;
  }

  if (!user) {
    status = "anon";
    session = null;
    emit();
    return;
  }

  const [profileRes, dogsRes] = await Promise.all([
    sb().from("profiles").select("role, owner_name, avatar_url").eq("id", user.id).single(),
    sb().from("dogs").select("id, name, photo_url").eq("account_id", user.id).order("sort_order"),
  ]);

  const profile = profileRes.data;
  const dogs: SessionDog[] = (dogsRes.data ?? []).map((d) => ({
    id: d.id as string,
    name: (d.name as string) ?? "",
    photo: (d.photo_url as string) ?? "",
  }));

  if (activeDogId === null) activeDogId = readActiveDog();

  session = withActiveDog(
    {
      ownerName: profile?.owner_name ?? user.email ?? "",
      dogName: "",
      dogPhoto: "",
      accountPhoto: profile?.avatar_url ?? undefined,
      role: profile?.role === "admin" ? "admin" : "member",
    },
    dogs
  );
  status = "authed";
  emit();
}

/** Start listening for auth changes once, on the client. */
function init() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  void hydrate();
  sb().auth.onAuthStateChange(() => {
    void hydrate();
  });
}

// --- actions --------------------------------------------------------------

/**
 * Sign in with email + password. Returns an error message (or null) and, on
 * success, the account's role so the caller can route (admin → /admin).
 */
export async function signInWithPassword(
  email: string,
  password: string
): Promise<{ error: string | null; role: Role | null }> {
  const { error } = await sb().auth.signInWithPassword({ email, password });
  if (error) return { error: error.message, role: null };
  await hydrate();
  return { error: null, role: session?.role ?? "member" };
}

/**
 * Create an account. Owner name + any dogs ride along in user metadata; a DB
 * trigger creates the profile (and dogs) and assigns the trainer role for
 * allowlisted emails. `needsConfirmation` is true when the project requires
 * email confirmation (no session yet).
 */
export async function signUpNewAccount(input: {
  email: string;
  password: string;
  ownerName: string;
  dogs?: SignUpDog[];
}): Promise<{ error: string | null; needsConfirmation: boolean }> {
  const { data, error } = await sb().auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        owner_name: input.ownerName,
        dogs: (input.dogs ?? [])
          .filter((d) => d.name.trim())
          .map((d) => ({ name: d.name.trim(), breed: d.breed?.trim() || undefined })),
      },
    },
  });
  if (error) return { error: error.message, needsConfirmation: false };
  const needsConfirmation = !data.session;
  if (!needsConfirmation) await hydrate();
  return { error: null, needsConfirmation };
}

/** Update the signed-in user's password. Returns an error message, or null. */
export async function updatePassword(password: string): Promise<{ error: string | null }> {
  const { error } = await sb().auth.updateUser({ password });
  return { error: error ? error.message : null };
}

/** Sign out and clear the session. */
export async function signOut() {
  await sb().auth.signOut();
  status = "anon";
  session = null;
  emit();
}

/** Switch the account's active dog — mirrors it into dogName/dogPhoto/dogId. */
export function setActiveDog(dogId: string) {
  if (!session?.dogs) return;
  activeDogId = dogId;
  try {
    localStorage.setItem(ACTIVE_DOG_KEY, dogId);
  } catch {
    /* ignore */
  }
  session = withActiveDog(session, session.dogs);
  emit();
}

/** Set the account's shared/joint photo (used as the account avatar). */
export function setAccountPhoto(dataUrl: string) {
  if (!session) return;
  session = { ...session, accountPhoto: dataUrl };
  emit();
  // TODO(backend): upload to Storage and persist profiles.avatar_url; for now
  // persist the URL/data-url straight onto the profile row.
  void sb().auth.getUser().then(({ data: { user } }) => {
    if (user) void sb().from("profiles").update({ avatar_url: dataUrl }).eq("id", user.id);
  });
}

// --- store wiring for useSyncExternalStore --------------------------------

function subscribe(cb: () => void) {
  listeners.add(cb);
  init();
  return () => {
    listeners.delete(cb);
  };
}

function getSessionSnapshot(): Session | null {
  return session;
}
function getStatusSnapshot(): AuthStatus {
  return status;
}

/** Server render (and the first client render) has no resolved session yet. */
function getServerSession(): Session | null {
  return null;
}
function getServerStatus(): AuthStatus {
  return "loading";
}

/** Subscribe a component to the signed-in account (null when signed out). */
export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, getSessionSnapshot, getServerSession);
}

/** Subscribe to the auth status — "loading" until Supabase resolves. */
export function useAuthStatus(): AuthStatus {
  return useSyncExternalStore(subscribe, getStatusSnapshot, getServerStatus);
}
