import { createClient } from "@supabase/supabase-js";

/**
 * Supabase with the service-role (secret) key: bypasses Row Level Security.
 * SERVER ONLY — used by the app's log-in endpoints to create an account and
 * keep one-use tickets. Never import this from a client component.
 */
export function adminConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type Admin = ReturnType<typeof createAdminClient>;
