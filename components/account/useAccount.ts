"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth/session";
import { getMyDogs, getMyProfile } from "@/lib/records/client";
import type { AccountProfile, DogRecord } from "@/lib/records/types";

/** The signed-in owner's profile row and dogs, for the account pages. */
export function useAccount() {
  const session = useSession();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [dogs, setDogs] = useState<DogRecord[] | null>(null);
  const [error, setError] = useState("");
  const signedIn = !!session;

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    Promise.all([getMyProfile(), getMyDogs()])
      .then(([p, d]) => {
        if (cancelled) return;
        setProfile(p);
        setDogs(d);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  return { profile, dogs, error };
}

export const accountCard = "rounded-2xl border border-white/10 bg-ink-soft p-6 sm:p-8";
