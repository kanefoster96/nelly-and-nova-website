/**
 * Auth session, backed by Supabase — same shape/approach as the website's
 * `lib/auth/session.ts` (same project, same `profiles` + `dogs` tables), so
 * an account behaves identically on web and native.
 *
 * `useSession()` returns the account (or null); `useAuthStatus()` distinguishes
 * "loading" from "anon" so gates don't flash signed-out while auth resolves.
 */
import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { stopNotifications } from "@/lib/notifications";
import type { User } from "@supabase/supabase-js";

export type Role = "member" | "admin";
export type AuthStatus = "loading" | "authed" | "anon";

export type SessionDog = { id: string; name: string; photo: string };

export type PickupLocation = { address: string; lat: number; lng: number } | null;

export type Session = {
  /** auth.users id — same as profiles.id / dogs.account_id. */
  id: string;
  ownerName: string;
  /** The account's avatar (profiles.avatar_url), for the top-bar avatar. */
  avatarUrl: string;
  /** All dogs on the account. The multi-dog switcher picks among these. */
  dogs: SessionDog[];
  /** Which of `dogs` is currently selected (persisted). Null only when `dogs` is empty. */
  activeDogId: string | null;
  /** Where this account is collected from for Walk & Train — set by the owner. */
  pickupLocation: PickupLocation;
  role: Role;
};

/** "Nova", "Nova & Rex", "Nova, Rex & Bella" — how an account is known by its dogs. */
export function joinNames(names: string[]): string {
  const list = names.filter(Boolean);
  if (list.length <= 1) return list[0] ?? "";
  return `${list.slice(0, -1).join(", ")} & ${list[list.length - 1]}`;
}

/** The currently-selected dog, or null if the account has none. */
export function activeDog(session: Session | null): SessionDog | null {
  if (!session) return null;
  return session.dogs.find((d) => d.id === session.activeDogId) ?? session.dogs[0] ?? null;
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

const ACTIVE_DOG_KEY = "nn-active-dog";

let status: AuthStatus = "loading";
let session: Session | null = null;
let activeDogIdCache: string | null = null;
let initialized = false;

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

async function readActiveDog(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ACTIVE_DOG_KEY);
  } catch {
    return null;
  }
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
    supabase
      .from("profiles")
      .select("role, owner_name, avatar_url, pickup_address, pickup_lat, pickup_lng")
      .eq("id", user.id)
      .single(),
    supabase.from("dogs").select("id, name, photo_url").eq("account_id", user.id).order("sort_order"),
  ]);

  const profile = profileRes.data;
  const dogs: SessionDog[] = (dogsRes.data ?? []).map((d) => ({
    id: d.id as string,
    name: (d.name as string) ?? "",
    photo: (d.photo_url as string) ?? "",
  }));

  if (activeDogIdCache === null) activeDogIdCache = await readActiveDog();
  const validActiveId = dogs.find((d) => d.id === activeDogIdCache)?.id ?? dogs[0]?.id ?? null;
  activeDogIdCache = validActiveId;

  session = {
    id: user.id,
    ownerName: profile?.owner_name ?? user.email ?? "",
    avatarUrl: profile?.avatar_url ?? "",
    dogs,
    activeDogId: validActiveId,
    pickupLocation:
      profile?.pickup_lat != null && profile?.pickup_lng != null
        ? { address: profile.pickup_address ?? "", lat: profile.pickup_lat, lng: profile.pickup_lng }
        : null,
    role: profile?.role === "admin" ? "admin" : "member",
  };
  status = "authed";
  emit();
}

/** Save the account's pickup location (used for Walk & Train collection). */
export async function setPickupLocation(location: { address: string; lat: number; lng: number }) {
  if (!session) return;
  const { error } = await supabase
    .from("profiles")
    .update({ pickup_address: location.address, pickup_lat: location.lat, pickup_lng: location.lng })
    .eq("id", session.id);
  if (error) return;
  session = { ...session, pickupLocation: location };
  emit();
}

/** Switch the account's active dog (multi-dog accounts). Persisted across launches. */
export function setActiveDog(dogId: string) {
  if (!session || !session.dogs.some((d) => d.id === dogId)) return;
  activeDogIdCache = dogId;
  session = { ...session, activeDogId: dogId };
  emit();
  AsyncStorage.setItem(ACTIVE_DOG_KEY, dogId).catch(() => {
    /* ignore */
  });
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
  stopNotifications();
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
