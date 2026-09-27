import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";

import { isSupabaseConfigured } from "@/lib/config";
import { supabase } from "@/lib/supabase";

export type Role = "admin" | "customer";

export type Profile = {
  id: string;
  role: Role;
  ownerName: string | null;
  avatarUrl: string | null;
};

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  /** True until the stored session (and its profile) has been read. */
  loading: boolean;
  isTrainer: boolean;
};

const AuthContext = createContext<AuthState>({ session: null, profile: null, loading: true, isTrainer: false });

async function loadProfile(session: Session): Promise<Profile> {
  const { data } = await supabase.from("profiles").select("id, role, owner_name, avatar_url").eq("id", session.user.id).maybeSingle();
  return {
    id: session.user.id,
    role: data?.role === "admin" ? "admin" : "customer",
    ownerName: data?.owner_name ?? (session.user.user_metadata?.owner_name as string | undefined) ?? null,
    avatarUrl: data?.avatar_url ?? null,
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;

    async function apply(next: Session | null) {
      const nextProfile = next ? await loadProfile(next).catch(() => null) : null;
      if (!active) return;
      setSession(next);
      setProfile(nextProfile);
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      // Token refreshes don't change who's signed in — skip the profile refetch.
      if (event === "TOKEN_REFRESHED") setSession(next);
      else if (event !== "INITIAL_SESSION") apply(next);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, profile, loading, isTrainer: profile?.role === "admin" }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
