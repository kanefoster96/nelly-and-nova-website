import { useSyncExternalStore } from "react";

/**
 * Whether an owner has been through the first-launch welcome
 * (app/(app)/welcome.tsx) on this phone: once per account per device, kept
 * in the same on-device storage as the sign-in (expo-sqlite's localStorage,
 * installed by lib/supabase.ts). Until they have, the app doesn't ask iOS
 * for notification permission (app/(app)/_layout.tsx): the welcome's
 * "Stay in the loop" page explains why first, then asks.
 */
const key = (userId: string) => `nn.welcome.v1.${userId}`;
const listeners = new Set<() => void>();

export function welcomeSeen(userId: string | null | undefined): boolean {
  if (!userId) return false;
  try {
    return localStorage.getItem(key(userId)) === "1";
  } catch {
    return false;
  }
}

export function markWelcomeSeen(userId: string | null | undefined): void {
  if (!userId) return;
  try {
    localStorage.setItem(key(userId), "1");
  } catch {
    // Storage unavailable: they may see the welcome again, which is harmless.
  }
  listeners.forEach((l) => l());
}

/** Live: re-renders when the welcome is finished. */
export function useWelcomeSeen(userId: string | null | undefined): boolean {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => welcomeSeen(userId),
  );
}
