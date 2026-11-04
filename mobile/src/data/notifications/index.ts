import { config } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import type { Notification } from "@/data/inbox/types";

export type { Notification } from "@/data/inbox/types";

/**
 * Notifications, straight from Supabase — the `notifications` table the
 * website reads too (supabase/migrations/20261104030000_notifications.sql in
 * the website repo). Each row is one person's copy; Row Level Security keeps
 * owners to their own, and a trainer (who can read everyone's) asks for
 * their own explicitly. Marking read is the only change anyone can make.
 *
 * action_href is an app path ("/chat", "/schedule"…), opened as-is.
 */

type Row = {
  id: string;
  title: string;
  body: string;
  action_href: string | null;
  sent_by_name: string | null;
  read_at: string | null;
  created_at: string;
};

const COLUMNS = "id, title, body, action_href, sent_by_name, read_at, created_at";

/** A leading emoji (with its variation selector and any joined parts) and the space after it. */
const LEADING_EMOJI = /^(\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*)\s+/u;

/**
 * Written with the emoji on the title ("📅 Your meet & greet is booked") and
 * shown as Kanvas's list does: a plain title, the emoji leading the line
 * under it (Kanvas's lib/notification-emoji.ts).
 */
export function emojiOnBody<T extends { title: string; body: string }>(n: T): T {
  const match = LEADING_EMOJI.exec(n.title);
  if (!match) return n;
  return { ...n, title: n.title.slice(match[0].length), body: n.body ? `${match[1]} ${n.body}` : match[1] };
}

/** App paths a notification may open. Anything else isn't offered as a tap. */
const APP_PATHS = ["/chat", "/schedule", "/homework", "/community", "/profile", "/notifications", "/registers", "/requests", "/dog", "/today", "/onboarding", "/conversation/", "/requests/"];
function appHref(href: string | null): string | undefined {
  if (!href) return undefined;
  const path = href.split(/[?#]/)[0];
  return APP_PATHS.some((p) => (p.endsWith("/") ? path.startsWith(p) : path === p)) ? path : undefined;
}

async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function getNotifications(): Promise<Notification[]> {
  const id = await myId();
  if (!id) return [];
  const { data, error } = await supabase
    .from("notifications")
    .select(COLUMNS)
    .eq("recipient_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map((r) =>
    emojiOnBody({
      id: r.id,
      title: r.title,
      body: r.body,
      createdAt: r.created_at,
      actionHref: appHref(r.action_href),
      sentByName: r.sent_by_name ?? "Nelly & Nova",
      recipientId: id,
      readAt: r.read_at,
    })
  );
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  const id = await myId();
  if (!id || ids.length === 0) return;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", id)
    .in("id", ids)
    .is("read_at", null);
  if (error) throw new Error(error.message);
}

/** Live: calls back when a notification arrives for this person. Returns an unsubscribe. */
export function subscribeToNotifications(recipientId: string, onInsert: () => void): () => void {
  const channel = supabase
    .channel(`notifications:${recipientId}:${Date.now()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${recipientId}` }, onInsert)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// --- trainer: Send a notification -----------------------------------------

export const NOTIFICATION_EMOJIS = ["🐾", "📅", "🚫", "☀️", "🌧️", "🎉", "📝", "⏰", "🏠", "❤️"];
export const TITLE_MAX = 60;
export const BODY_MAX = 500;

/** "Tapping it opens" (the same list as the website's lib/notifications/links.ts). */
export const NOTIFICATION_LINKS: { value: string; label: string }[] = [
  { value: "", label: "Nothing" },
  { value: "/schedule", label: "Schedule" },
  { value: "/homework", label: "Homework" },
  { value: "/community", label: "Community" },
  { value: "/chat", label: "Chat" },
  { value: "/profile", label: "Profile" },
];

export type Owner = { id: string; name: string; avatarUrl: string | null; dogs: string[] };

/** Every owner (not trainers), with their dogs, for "Choose owners". */
export async function getOwners(): Promise<Owner[]> {
  const [profiles, dogs] = await Promise.all([
    supabase.from("profiles").select("id, owner_name, email, avatar_url").neq("role", "admin").order("owner_name"),
    supabase.from("dogs").select("account_id, name"),
  ]);
  if (profiles.error) throw new Error(profiles.error.message);
  const byOwner = new Map<string, string[]>();
  for (const d of (dogs.data ?? []) as { account_id: string; name: string }[]) {
    byOwner.set(d.account_id, [...(byOwner.get(d.account_id) ?? []), d.name]);
  }
  return ((profiles.data ?? []) as { id: string; owner_name: string | null; email: string | null; avatar_url: string | null }[]).map((p) => ({
    id: p.id,
    name: p.owner_name || p.email || "Owner",
    avatarUrl: p.avatar_url,
    dogs: byOwner.get(p.id) ?? [],
  }));
}

/** Sends through the website (it holds the push sender): a row each and an app push. */
export async function sendNotification(input: {
  title: string;
  body: string;
  audience: "everyone" | "chosen";
  recipientIds: string[];
  path: string;
}): Promise<{ sent: number; pushed: number }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  const res = await fetch(new URL("/api/notifications/send", config.siteUrl).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string; sent?: number; pushed?: number };
  if (!res.ok) throw new Error(json.error || "Couldn't send that — please try again.");
  return { sent: json.sent ?? 0, pushed: json.pushed ?? 0 };
}
