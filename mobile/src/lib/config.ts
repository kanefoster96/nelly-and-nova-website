/**
 * Public runtime config. EXPO_PUBLIC_* vars are inlined at bundle time, so they
 * come from .env.local locally and from EAS environment variables in builds
 * and `eas update` (pass --environment).
 */
export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.EXPO_PUBLIC_SITE_URL ?? "https://nelly-and-nova-website.vercel.app",
};

export const isSupabaseConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
