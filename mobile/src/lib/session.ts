/**
 * Auth session, backed by Supabase — same shape/approach as the website's
 * `lib/auth/session.ts` (same project, same `profiles` + `dogs` tables), so
 * an account behaves identically on web and native.
 *
 * `useSession()` returns the account (or null); `useAuthStatus()` distinguishes
 * "loading" from "anon" so gates don't flash signed-out while auth resolves.
 */
import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export type Role = "member" | "admin";
export type AuthStatus = "loading" | "authed" | "anon";

export type SessionDog = { id: string; name: string; photo: string };

export type Session = {
  /** auth.users id — same as profiles.id / dogs.account_id. */
  id: string;
  ownerName: string;
  /** The account's avatar (profiles.avatar_url), for the top-bar avatar. */
  avatarUrl: string;
  dogs: SessionDog[];
  role: Role;
};

/** "Nova", "Nova & Rex", "Nova, Rex & Bella" — how an account is known by its dogs. */
export function joinNames(names: string[]): string {
  const list = names.filter(Boolean);
  if (list.length <= 1) return list[0] ?? "";
  return `${list.slice(0, -1).join(", ")} & ${list[list.length - 1]}`;
}

/**
 * Whether this account should see the customer app. There's no dedicated
 * "membership status" column in the database yet — a dog only gets created
 * on the account once a membership is set up (see the website's onboarding
 * flow), so "has at least one dog" is the closest real signal available.
 * TODO(backend): switch to a real `profiles.membership_status` (or similar)
 * once that field exists, rather than inferring it from dogs.
 */
export function hasActiveMembership(session: Session | null): boolean {
  return !!session && session.dogs.length > 0;
}

let status: AuthStatus = "loading";
let session: Session | null = null;
let initialized = false;

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

/** Rebuild the Session from the current Supabase user + profile + dogs. */
async function hydrate() {
  let user: User | null = null;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch {
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
    supabase.from("profiles").select("role, owner_name, avatar_url").eq("id", user.id).single(),
    supabase.from("dogs").select("id, name, photo_url").eq("account_id", user.id).order("sort_order"),
  ]);

  const profile = profileRes.data;
  const dogs: SessionDog[] = (dogsRes.data ?? []).map((d) => ({
    id: d.id as string,
    name: (d.name as string) ?? "",
    photo: (d.photo_url as string) ?? "",
  }));

  session = {
    id: user.id,
    ownerName: profile?.owner_name ?? user.email ?? "",
    avatarUrl: profile?.avatar_url ?? "",
    dogs,
    role: profile?.role === "admin" ? "admin" : "member",
  };
  status = "authed";
  emit();
}

function init() {
  if (initialized) return;
  initialized = true;
  void hydrate();
  supabase.auth.onAuthStateChange(() => {
    void hydrate();
  });
}

/** Sign out and clear the session. */
export async function signOut() {
  await supabase.auth.signOut();
  status = "anon";
  session = null;
  emit();
}

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

export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, getSessionSnapshot);
}

export function useAuthStatus(): AuthStatus {
  return useSyncExternalStore(subscribe, getStatusSnapshot);
}
