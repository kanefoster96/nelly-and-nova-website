/**
 * In-app notifications — real-time via Supabase Realtime, drives the
 * top-bar bell's badge and the full list at customer/notifications.tsx.
 * Works whether or not push is registered (lib/push.ts) — this is the
 * always-on path; push is the "phone buzzes with the app closed" extra.
 */
import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type NotificationKind =
  | "info"
  | "pickup_eta"
  | "dropoff_eta"
  | "chat_message"
  | "reschedule_accepted"
  | "report_card_published"
  | "broadcast";

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  sessionId: string | null;
  readAt: string | null;
  createdAt: string;
};

let items: NotificationItem[] = [];
let channel: RealtimeChannel | null = null;
let currentUserId: string | null = null;
let initialized = false;

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

function mapRow(row: Record<string, unknown>): NotificationItem {
  return {
    id: row.id as string,
    kind: row.kind as NotificationKind,
    title: row.title as string,
    body: row.body as string,
    sessionId: (row.session_id as string) ?? null,
    readAt: (row.read_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

async function loadFor(userId: string) {
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, session_id, read_at, created_at")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false });
  items = (data ?? []).map(mapRow);
  emit();
}

function subscribeRealtime(userId: string) {
  channel?.unsubscribe();
  channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` },
      (payload) => {
        if (payload.eventType === "DELETE") {
          items = items.filter((n) => n.id !== (payload.old as { id: string }).id);
        } else {
          const row = mapRow(payload.new as Record<string, unknown>);
          items = [row, ...items.filter((n) => n.id !== row.id)].sort((a, b) =>
            b.createdAt.localeCompare(a.createdAt)
          );
        }
        emit();
      }
    )
    .subscribe();
}

async function reset(userId: string | null) {
  currentUserId = userId;
  channel?.unsubscribe();
  channel = null;
  if (!userId) {
    items = [];
    emit();
    return;
  }
  await loadFor(userId);
  subscribeRealtime(userId);
}

function init() {
  if (initialized) return;
  initialized = true;

  supabase.auth.getUser().then(({ data: { user } }) => {
    void reset(user?.id ?? null);
  });

  supabase.auth.onAuthStateChange((_event, authSession) => {
    const userId = authSession?.user?.id ?? null;
    if (userId !== currentUserId) void reset(userId);
  });
}

export async function markNotificationRead(id: string): Promise<void> {
  items = items.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n));
  emit();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
}

export async function markAllNotificationsRead(): Promise<void> {
  if (!currentUserId) return;
  const now = new Date().toISOString();
  items = items.map((n) => (n.readAt ? n : { ...n, readAt: now }));
  emit();
  await supabase
    .from("notifications")
    .update({ read_at: now })
    .eq("recipient_id", currentUserId)
    .is("read_at", null);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  init();
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): NotificationItem[] {
  return items;
}

export function useNotifications(): NotificationItem[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function useUnreadNotificationCount(): number {
  return useSyncExternalStore(subscribe, () => items.filter((n) => !n.readAt).length);
}
