import { postToSite } from "@/lib/site-api";
import { supabase } from "@/lib/supabase";

/**
 * The pick-up and drop-off runs on the trainer's Today tab, saved in
 * route_stops (supabase/migrations/20261104070000_trainer_today.sql,
 * trainers only): the order each run goes in, per date, and how far along
 * each stop is (waiting → on_route → done). Dogs without a row go at the
 * end in the day's own order; the drop-off run copies the pick-up order
 * until it's rearranged. "On route" tells the owner through the website
 * (app/api/route/notify, wording in lib/route/messages.ts there).
 */

export type RouteRun = "pickup" | "dropoff";
export type StopStatus = "waiting" | "on_route" | "done";
export type RouteStop = { id: string; dogId: string; position: number; status: StopStatus; notifiedAt: string | null };

/** Each run's saved stops for a date, by dog. */
export type RouteState = Record<RouteRun, Map<string, RouteStop>>;

export async function getRouteStops(date: string): Promise<RouteState> {
  const { data, error } = await supabase.from("route_stops").select("id, run, dog_id, position, status, notified_at").eq("on_date", date);
  if (error) throw new Error(error.message);
  const out: RouteState = { pickup: new Map(), dropoff: new Map() };
  for (const r of (data ?? []) as { id: string; run: RouteRun; dog_id: string; position: number; status: StopStatus; notified_at: string | null }[]) {
    out[r.run]?.set(r.dog_id, { id: r.id, dogId: r.dog_id, position: r.position, status: r.status, notifiedAt: r.notified_at });
  }
  return out;
}

/** Saved order first, then the rest in their default order. */
function ordered(dogIds: string[], stops: Map<string, RouteStop>): string[] {
  const saved = dogIds.filter((id) => stops.has(id)).sort((a, b) => stops.get(a)!.position - stops.get(b)!.position);
  return [...saved, ...dogIds.filter((id) => !stops.has(id))];
}

/** The order of a run. The drop-off run follows the pick-up run until it's been saved on its own. */
export function runOrder(run: RouteRun, dogIds: string[], state: RouteState): string[] {
  const pickup = ordered(dogIds, state.pickup);
  if (run === "pickup") return pickup;
  return state.dropoff.size === 0 ? pickup : ordered(pickup, state.dropoff);
}

async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Save a run's whole order (positions only: each stop keeps its status). */
export async function saveRunOrder(date: string, run: RouteRun, dogIds: string[]): Promise<Map<string, RouteStop>> {
  const me = await myId();
  const { data, error } = await supabase
    .from("route_stops")
    .upsert(
      dogIds.map((dog_id, position) => ({ on_date: date, run, dog_id, position, updated_by: me })),
      { onConflict: "on_date,run,dog_id" },
    )
    .select("id, dog_id, position, status, notified_at");
  if (error) throw new Error("Couldn't save the order.");
  const out = new Map<string, RouteStop>();
  for (const r of (data ?? []) as { id: string; dog_id: string; position: number; status: StopStatus; notified_at: string | null }[]) {
    out.set(r.dog_id, { id: r.id, dogId: r.dog_id, position: r.position, status: r.status, notifiedAt: r.notified_at });
  }
  return out;
}

/**
 * Move a stop along (waiting / on_route / done). The run's order is saved
 * first if any stop on it hasn't been, so the order on screen is the one
 * kept. Returns the stop.
 */
export async function setStopStatus(date: string, run: RouteRun, order: string[], dogId: string, status: StopStatus, saved: Map<string, RouteStop>): Promise<RouteStop> {
  let stop = saved.get(dogId);
  if (!stop || order.some((id) => !saved.has(id))) stop = (await saveRunOrder(date, run, order)).get(dogId);
  if (!stop) throw new Error("Couldn't save that stop.");
  const { data, error } = await supabase
    .from("route_stops")
    .update({ status, updated_by: await myId() })
    .eq("id", stop.id)
    .select("id, dog_id, position, status, notified_at")
    .single();
  if (error || !data) throw new Error("Couldn't update that stop.");
  const r = data as { id: string; dog_id: string; position: number; status: StopStatus; notified_at: string | null };
  return { id: r.id, dogId: r.dog_id, position: r.position, status: r.status, notifiedAt: r.notified_at };
}

/**
 * Tell the owner we're on the way (a notification and a push). Once per
 * stop: `again` only after the trainer has confirmed "Send again?".
 */
export async function notifyOnRoute(stopId: string, again = false): Promise<{ notified: boolean; alreadySent: boolean }> {
  const res = await postToSite<{ notified?: boolean; alreadySent?: boolean; error?: string }>("/api/route/notify", { stopId, again }, "Couldn't notify the owner.");
  if (!res.notified && !res.alreadySent && res.error) throw new Error(res.error);
  return { notified: !!res.notified, alreadySent: !!res.alreadySent };
}
