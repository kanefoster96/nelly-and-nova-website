import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { callerClient } from "@/lib/sessions/auth";
import { pushNotices } from "@/lib/sessions/push";

/**
 * After a session change in the app or on the website (a cancellation, a
 * request, a trainer's decision, a move), push the notifications it made.
 * The database wrote the rows and returned their ids; this sends each one
 * to its recipient's phone, once. Only rows the caller sent in the last ten
 * minutes go, so nobody can push anything else.
 * Signed in by cookie (website) or a Bearer token (the app).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const supabase = await callerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  if (!adminConfigured()) return Response.json({ ok: true, pushed: 0 });
  const pushed = await pushNotices(createAdminClient(), body?.notices, user.id);
  return Response.json({ ok: true, pushed });
}
