/**
 * Public runtime config. EXPO_PUBLIC_* env vars (from .env.local locally, or
 * EAS environment variables in builds/updates) override these defaults.
 *
 * The Supabase URL and publishable key are public by design — the website
 * ships the same values in its browser JS. Data is protected by Row Level
 * Security in Supabase, not by hiding these. Never put the secret /
 * service-role key here.
 */
const DEFAULT_SUPABASE_URL = "https://kqreuupspgifbhhxpfxu.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ZSxYdttg_L4KPUb-Gxoopg_NtuJFBU9";

export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  siteUrl: process.env.EXPO_PUBLIC_SITE_URL || "https://nelly-and-nova-website.vercel.app",
};

export const isSupabaseConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
