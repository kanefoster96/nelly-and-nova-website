/**
 * Coach-side collection route planning — today's Walk & Train pickups,
 * reordered into a route, with "Start next pickup" sending the next
 * account a heads-up. Real tables: `training_sessions` (route_order,
 * pickup_status) + `notifications` (see the
 * "collection_routes_and_notifications" migration).
 *
 * No routing API — a precise ETA needs a paid Directions key for what's
 * really just "give the next owner a few minutes' notice", so this sends a
 * fixed ~10–20 minute window instead of computing one. Simpler, free, and
 * honest about not being a real-time estimate.
 */
import { supabase } from "@/lib/supabase";
import { sendPushNotification } from "@/lib/push";

export type PickupStatus = "pending" | "notified" | "collected";

export type CollectionStop = {
  sessionId: string;
  accountId: string;
  dogName: string;
  ownerName: string;
  scheduledAt: string;
  routeOrder: number | null;
  pickupStatus: PickupStatus;
  pickupLocation: { address: string; lat: number; lng: number } | null;
  pushToken: string | null;
};

type Profile = {
  owner_name: string | null;
  pickup_address: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  push_token: string | null;
};

type StopRow = {
  id: string;
  account_id: string;
  scheduled_at: string;
  route_order: number | null;
  pickup_status: PickupStatus;
  dogs: { name: string } | { name: string }[] | null;
  profiles: Profile | Profile[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function mapStop(row: StopRow): CollectionStop {
  const dog = one(row.dogs);
  const profile = one(row.profiles);
  return {
    sessionId: row.id,
    accountId: row.account_id,
    dogName: dog?.name ?? "",
    ownerName: profile?.owner_name ?? "",
    scheduledAt: row.scheduled_at,
    routeOrder: row.route_order,
    pickupStatus: row.pickup_status,
    pickupLocation:
      profile?.pickup_lat != null && profile?.pickup_lng != null
        ? { address: profile.pickup_address ?? "", lat: profile.pickup_lat, lng: profile.pickup_lng }
        : null,
    pushToken: profile?.push_token ?? null,
  };
}

/** Today's Walk & Train collections, in route order. */
export async function getTodayCollections(): Promise<CollectionStop[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const { data } = await supabase
    .from("training_sessions")
    .select(
      "id, account_id, scheduled_at, route_order, pickup_status, dogs(name), profiles(owner_name, pickup_address, pickup_lat, pickup_lng, push_token)"
    )
    .eq("kind", "walk-and-train")
    .eq("status", "scheduled")
    .gte("scheduled_at", start.toISOString())
    .lte("scheduled_at", end.toISOString());

  const stops = ((data ?? []) as StopRow[]).map(mapStop);
  stops.sort((a, b) => {
    if (a.routeOrder != null && b.routeOrder != null) return a.routeOrder - b.routeOrder;
    if (a.routeOrder != null) return -1;
    if (b.routeOrder != null) return 1;
    return a.scheduledAt.localeCompare(b.scheduledAt);
  });
  return stops;
}

/** Persist the given order as each stop's route_order (0-based). */
export async function saveRouteOrder(stops: CollectionStop[]): Promise<void> {
  await Promise.all(
    stops.map((stop, i) => supabase.from("training_sessions").update({ route_order: i }).eq("id", stop.sessionId))
  );
}

/** Move a stop up or down and persist the new order for everyone. */
export async function moveStop(stops: CollectionStop[], sessionId: string, direction: "up" | "down"): Promise<CollectionStop[]> {
  const index = stops.findIndex((s) => s.sessionId === sessionId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= stops.length) return stops;

  const reordered = [...stops];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  await saveRouteOrder(reordered);
  return reordered;
}

const PICKUP_NOTICE = "Your dog is next to be picked up — usually around 10–20 minutes.";

/**
 * Mark the current "notified" stop collected (if any) and give the next
 * pending stop a heads-up — an in-app/Realtime notification always, plus a
 * real OS push if that account has one registered (best-effort — a missing
 * or failed push never blocks the in-app one, which is the source of truth).
 */
export async function startNextPickup(stops: CollectionStop[]): Promise<{ notified: CollectionStop | null }> {
  const currentIndex = stops.findIndex((s) => s.pickupStatus === "notified");
  if (currentIndex >= 0) {
    await supabase.from("training_sessions").update({ pickup_status: "collected" }).eq("id", stops[currentIndex].sessionId);
  }

  const nextIndex = stops.findIndex((s) => s.pickupStatus === "pending");
  if (nextIndex < 0) return { notified: null };

  const next = stops[nextIndex];
  const title = "You're next for pickup";

  await supabase.from("training_sessions").update({ pickup_status: "notified" }).eq("id", next.sessionId);

  await supabase.from("notifications").insert({
    recipient_id: next.accountId,
    kind: "pickup_eta",
    title,
    body: PICKUP_NOTICE,
    session_id: next.sessionId,
  });

  if (next.pushToken) {
    void sendPushNotification(next.pushToken, title, PICKUP_NOTICE, { sessionId: next.sessionId });
  }

  return { notified: { ...next, pickupStatus: "notified" } };
}
