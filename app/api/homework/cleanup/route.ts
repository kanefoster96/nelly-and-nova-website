import { callerClient } from "@/lib/sessions/auth";
import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { removeHomeworkVideos } from "@/lib/homework/cleanup";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Right after a homework's 3rd day (the app calls this): delete its videos.
 * Signed in by a Bearer token (the app) or the website's cookie. The
 * database decides what may go (nn_homework_videos_to_clean): only for the
 * owner of that homework's dog or a trainer, and only once it really is
 * complete. The files are removed with the service-role key.
 *
 * Body: { cardId }
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { cardId?: unknown } | null;
  const cardId = typeof body?.cardId === "string" ? body.cardId : "";
  if (!UUID_RE.test(cardId)) return Response.json({ error: "Invalid request." }, { status: 400 });

  const supabase = await callerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });

  const { data: paths, error } = await supabase.rpc("nn_homework_videos_to_clean", { p_card_id: cardId });
  if (error) return Response.json({ error: "Couldn't check that homework." }, { status: 500 });
  const list = Array.isArray(paths) ? (paths as unknown[]).filter((p): p is string => typeof p === "string") : [];
  if (list.length === 0) return Response.json({ ok: true, removed: 0 });
  // Not set up yet: the daily sweep catches it once it is.
  if (!adminConfigured()) return Response.json({ ok: true, removed: 0, later: true });

  const removed = await removeHomeworkVideos(createAdminClient(), cardId, list);
  return Response.json({ ok: true, removed });
}
