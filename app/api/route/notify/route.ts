import { callerClient } from "@/lib/sessions/auth";
import { notifyAccount } from "@/lib/notifications/send";
import { firstName, onRouteMessage, stopDoneMessage, type RouteRun } from "@/lib/route/messages";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A trainer has tapped "On route" on a pick-up or drop-off stop in the app's
 * Today tab (the app has already marked the stop on_route): tell the dog's
 * owner we're on the way, with a notification row and a push that opens
 * their Profile tab. The wording is in lib/route/messages.ts.
 *
 * Sent once per stop: the stop's notified_at is claimed in one update, so a
 * double tap can't send twice. `again: true` (after the trainer confirmed
 * "Send again?") sends it anyway.
 *
 * `event: "done"` (after the trainer taps "Picked up" or "Dropped off",
 * once the app has marked the stop done) tells the owner instead: "🐾 Bella's
 * with us" or "🏡 Bella's home". Only for a stop that really is done, and
 * once per stop (done_notified_at, supabase/migrations/20261104110000_owner_flow.sql),
 * so an Undo and a second tap don't send it again.
 *
 * Signed in by cookie (website) or a Bearer token (the app). Trainers only:
 * route_stops is trainer-only under Row Level Security too.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const stopId = typeof body?.stopId === "string" ? body.stopId : "";
  const again = body?.again === true;
  const event = body?.event === "done" ? "done" : "on_route";
  if (!UUID.test(stopId)) return Response.json({ error: "Invalid request." }, { status: 400 });

  const supabase = await callerClient(request);
  const { data: isAdmin } = await supabase.rpc("nn_is_admin");
  if (isAdmin !== true) return Response.json({ error: "Trainers only." }, { status: 403 });

  if (event === "done") return notifyDone(supabase, stopId);

  // Claim the send: only one request gets the row back (unless sending again).
  let claim = supabase.from("route_stops").update({ notified_at: new Date().toISOString() }).eq("id", stopId);
  if (!again) claim = claim.is("notified_at", null);
  const { data: stop, error } = await claim.select("id, run, dog_id").maybeSingle();
  if (error) return Response.json({ error: "Couldn't update that stop." }, { status: 500 });
  if (!stop) return Response.json({ ok: true, alreadySent: true, notified: false });

  const { data: dog } = await supabase.from("dogs").select("name, account_id").eq("id", stop.dog_id).maybeSingle();
  if (!dog?.account_id) return Response.json({ ok: true, notified: false, error: "This dog has no owner on file." });
  const { data: owner } = await supabase.from("profiles").select("owner_name").eq("id", dog.account_id).maybeSingle();

  const message = onRouteMessage(stop.run as RouteRun, (dog.name as string) || "your dog", firstName(owner?.owner_name as string | null));
  const { saved, pushed } = await notifyAccount(supabase, dog.account_id as string, { ...message, path: "/dog", kind: "info" });
  if (!saved && !pushed) {
    // Nothing went: free the stop so it can be tried again.
    if (!again) await supabase.from("route_stops").update({ notified_at: null }).eq("id", stopId);
    return Response.json({ error: "Couldn't notify the owner. Please try again." }, { status: 502 });
  }
  return Response.json({ ok: true, notified: true, pushed });
}

/** "Picked up" / "Dropped off": claim the stop's done_notified_at, then tell the owner. */
async function notifyDone(supabase: Awaited<ReturnType<typeof callerClient>>, stopId: string) {
  const { data: stop, error } = await supabase
    .from("route_stops")
    .update({ done_notified_at: new Date().toISOString() })
    .eq("id", stopId)
    .eq("status", "done")
    .is("done_notified_at", null)
    .select("id, run, dog_id")
    .maybeSingle();
  if (error) return Response.json({ error: "Couldn't update that stop." }, { status: 500 });
  if (!stop) return Response.json({ ok: true, alreadySent: true, notified: false });

  const { data: dog } = await supabase.from("dogs").select("name, account_id").eq("id", stop.dog_id).maybeSingle();
  if (!dog?.account_id) return Response.json({ ok: true, notified: false, error: "This dog has no owner on file." });

  const message = stopDoneMessage(stop.run as RouteRun, (dog.name as string) || "your dog");
  const { saved, pushed } = await notifyAccount(supabase, dog.account_id as string, { ...message, path: "/dog", kind: "info" });
  if (!saved && !pushed) {
    await supabase.from("route_stops").update({ done_notified_at: null }).eq("id", stopId);
    return Response.json({ error: "Couldn't notify the owner." }, { status: 502 });
  }
  return Response.json({ ok: true, notified: true, pushed });
}
