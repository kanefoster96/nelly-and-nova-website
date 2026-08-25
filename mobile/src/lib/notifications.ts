/**
 * In-app notifications — real `notifications` table, live via Supabase
 * Realtime (see the "collection_routes_and_notifications" migration) so a
 * pickup ETA shows up the moment the coach sends it, not just on refresh.
 * Only staff create rows here (RLS); accounts can only read/mark their own.
 */
import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type AppNotification = {
  id: string;
  kind: "info" | "pickup_eta" | "dropoff_eta";
  title: string;
  body: string;
  sessionId: string | null;
  read: boolean;
  createdAt: string;
};

let notifications: AppNotification[] = [];
let initialized = false;
let channel: RealtimeChannel | null = null;

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

function mapRow(row: {
  id: string;
  kind: AppNotification["kind"];
  title: string;
  body: string;
  session_id: string | null;
  read_at: string | null;
  created_at: string;
}): AppNotification {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    sessionId: row.session_id,
    read: row.read_at != null,
    createdAt: row.created_at,
  };
}

async function init() {
  if (initialized) return;
  initialized = true;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, session_id, read_at, created_at")
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  notifications = (data ?? []).map(mapRow);
  emit();

  channel = supabase
    .channel(`notifications:${user.id}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
      (payload) => {
        if (payload.eventType === "INSERT") {
          notifications = [mapRow(payload.new as never), ...notifications];
        } else if (payload.eventType === "UPDATE") {
          const updated = mapRow(payload.new as never);
          notifications = notifications.map((n) => (n.id === updated.id ? updated : n));
        }
        emit();
      }
    )
    .subscribe();
}

export async function markRead(id: string) {
  notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
  emit();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
}

export async function markAllRead() {
  const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
  if (unreadIds.length === 0) return;
  notifications = notifications.map((n) => ({ ...n, read: true }));
  emit();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
}

/** Tear down the realtime subscription (e.g. on sign-out) — otherwise the store stays live for the app's lifetime. */
export function stopNotifications() {
  channel?.unsubscribe();
  channel = null;
  initialized = false;
  notifications = [];
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  void init();
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): AppNotification[] {
  return notifications;
}

export function useNotifications(): AppNotification[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function useUnreadNotificationCount(): number {
  const list = useNotifications();
  return list.filter((n) => !n.read).length;
}

/** The most recent unread pickup-ETA notification, if any — for the "you're next" banner. */
export function useLatestPickupEta(): AppNotification | null {
  const list = useNotifications();
  return list.find((n) => n.kind === "pickup_eta" && !n.read) ?? null;
}
