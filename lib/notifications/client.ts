"use client";

/**
 * Your notifications, from the browser. Row Level Security keeps everyone to
 * their own (a trainer can read everyone's, so the list asks for its own
 * explicitly); marking read is the only change anyone can make.
 */
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/lib/inbox/types";
import { NOTIFICATION_COLUMNS, toNotification, type NotificationRow } from "./links";

let client: ReturnType<typeof createClient> | null = null;
function supabase() {
  if (!client) client = createClient();
  return client;
}

async function myId(): Promise<string | null> {
  const { data } = await supabase().auth.getUser();
  return data.user?.id ?? null;
}

export async function fetchMyNotifications(): Promise<Notification[]> {
  const id = await myId();
  if (!id) return [];
  const { data, error } = await supabase()
    .from("notifications")
    .select(NOTIFICATION_COLUMNS)
    .eq("recipient_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return ((data ?? []) as NotificationRow[]).map(toNotification);
}

export async function markNotificationsRead(ids?: string[]): Promise<void> {
  const id = await myId();
  if (!id) return;
  let q = supabase().from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_id", id).is("read_at", null);
  if (ids) q = q.in("id", ids);
  await q;
}

export async function unreadNotificationCount(): Promise<number> {
  const id = await myId();
  if (!id) return 0;
  const { count } = await supabase()
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", id)
    .is("read_at", null);
  return count ?? 0;
}
