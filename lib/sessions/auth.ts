import { createClient as createSupabase, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * The caller's own Supabase client: a Bearer token from the app, or the
 * website's cookie session. Row Level Security applies as that person.
 */
export async function callerClient(request: Request): Promise<SupabaseClient> {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return bearer
    ? createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : ((await createClient()) as unknown as SupabaseClient);
}
