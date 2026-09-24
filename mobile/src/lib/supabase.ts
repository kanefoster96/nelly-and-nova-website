import "expo-sqlite/localStorage/install";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

import { config, isSupabaseConfigured } from "./config";

/**
 * Same Supabase project as the website. The session is persisted in
 * expo-sqlite's localStorage so users stay signed in between launches.
 */
export const supabase = createClient(
  config.supabaseUrl || "https://placeholder.supabase.co",
  config.supabaseAnonKey || "placeholder",
  {
    auth: {
      storage: localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Only refresh tokens while the app is in the foreground.
if (isSupabaseConfigured) {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
