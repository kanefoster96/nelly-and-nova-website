import { createClient as createSupabase } from "@supabase/supabase-js";
import { deleteAccountFor } from "@/lib/account/delete";
import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";

/** The app's "Delete my account" (Bearer token). Same as the website's page. */
export async function POST(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!bearer) return Response.json({ error: "Please log in." }, { status: 401 });
  const supabase = createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await supabase.auth.getUser(bearer);
  if (!data.user) return Response.json({ error: "Please log in." }, { status: 401 });
  if (!adminConfigured()) return Response.json({ error: "Please try again later, or contact us." }, { status: 503 });
  const result = await deleteAccountFor(createAdminClient(), data.user.id);
  if (!result.success) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ ok: true });
}
