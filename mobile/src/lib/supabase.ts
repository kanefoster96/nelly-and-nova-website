import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client for the native app — same project as the website
 * (see `lib/supabase/client.ts` in the root project), so accounts, dogs and
 * session data are shared across web and mobile. Sessions persist to
 * AsyncStorage so signed-in users stay logged in between app launches.
 */
let supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
let supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Falls back to a placeholder so the client can still construct (and the
  // app can still render) without a .env — every request will then fail at
  // call time, which lib/session.ts already treats as signed-out. Copy
  // .env.example to .env and fill in real values to actually talk to Supabase.
  console.warn(
    "[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set — copy .env.example to .env."
  );
  supabaseUrl ??= "https://placeholder.supabase.co";
  supabaseAnonKey ??= "placeholder-anon-key";
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
