import { config } from "@/lib/config";
import { supabase } from "@/lib/supabase";

import { getUnreadCounts, toCard } from "./cards";
import type { Attachment, Conversation, Message } from "./types";

export type { Attachment, Conversation, Message } from "./types";
export type { ChatCard, RequestStatus } from "./cards";
export { formatDate, formatTime } from "./format";

/**
 * Live chat, straight from Supabase — the same tables and nn_chat_* functions
 * as the website (see supabase/migrations/20261103000000_chat.sql in the
 * website repo). Reads go through Row Level Security; every write goes
 * through a function that checks whether you're the conversation's owner or
 * a trainer.
 */

const BUCKET = "chat-attachments";
// Every column, so a card's kind and meta come too where the database has them,
// and nothing breaks where it doesn't yet (supabase/migrations/20261104120000_chat_cards.sql).
const MESSAGE_COLUMNS = "*";

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  sender_is_staff: boolean;
  sender_name: string | null;
  body: string | null;
  attachment_path: string | null;
  attachment_type: Attachment["type"] | null;
  attachment_name: string | null;
  created_at: string;
  kind?: string | null;
  meta?: unknown;
};

type Team = Record<string, { name: string | null; avatarUrl: string | null }>;

let teamCache: Promise<Team> | null = null;
/** The trainers' names and photos, for the avatar on team messages. */
function getTeam(): Promise<Team> {
  if (!teamCache) {
    teamCache = Promise.resolve(supabase.rpc("nn_chat_team")).then(({ data }) => {
      const team: Team = {};
      for (const row of (data ?? []) as { id: string; name: string | null; avatar_url: string | null }[]) {
        team[row.id] = { name: row.name, avatarUrl: row.avatar_url };
      }
      return team;
    });
    teamCache.catch(() => {
      teamCache = null;
    });
  }
  return teamCache;
}

/**
 * A homework video sent with "Complete today" is kept in its own bucket
 * (the attachment reads "homework-videos/<path>") and deleted once the
 * homework is complete: supabase/migrations/20261104080000_owner_onboarding.sql.
 */
export const HOMEWORK_VIDEO_PREFIX = "homework-videos/";

async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const chat = paths.filter((p) => !p.startsWith(HOMEWORK_VIDEO_PREFIX));
  const homework = paths.filter((p) => p.startsWith(HOMEWORK_VIDEO_PREFIX)).map((p) => p.slice(HOMEWORK_VIDEO_PREFIX.length));
  const [chatRes, homeworkRes] = await Promise.all([
    chat.length ? supabase.storage.from(BUCKET).createSignedUrls(chat, 60 * 60) : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
    homework.length ? supabase.storage.from("homework-videos").createSignedUrls(homework, 60 * 60) : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
  ]);
  const urls: Record<string, string> = {};
  for (const item of chatRes.data ?? []) if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  for (const item of homeworkRes.data ?? []) if (item.path && item.signedUrl) urls[`${HOMEWORK_VIDEO_PREFIX}${item.path}`] = item.signedUrl;
  return urls;
}

/** Rows → messages, with team names/photos and attachment links filled in. */
export async function toMessages(rows: MessageRow[]): Promise<Message[]> {
  const [team, urls] = await Promise.all([
    getTeam().catch(() => ({}) as Team),
    signedUrls(rows.map((r) => r.attachment_path).filter((p): p is string => !!p)),
  ]);
  return rows.map((r) => {
    const member = r.sender_id ? team[r.sender_id] : undefined;
    return {
      id: r.id,
      conversationId: r.conversation_id,
      body: r.body ?? "",
      fromStaff: r.sender_is_staff,
      senderId: r.sender_id,
      senderName: r.sender_is_staff ? (r.sender_name ?? member?.name ?? undefined) : undefined,
      senderAvatarUrl: member?.avatarUrl ?? null,
      createdAt: r.created_at,
      attachment:
        r.attachment_path && r.attachment_type
          ? {
              type: r.attachment_type,
              name: r.attachment_name ?? "File",
              url: urls[r.attachment_path] ?? "",
              removed: r.attachment_path.startsWith(HOMEWORK_VIDEO_PREFIX) && !urls[r.attachment_path],
            }
          : undefined,
      card: toCard(r.kind, r.meta),
    };
  });
}

function previewFor(body: string | null, type: string | null): string {
  if (body) return body;
  if (type === "image") return "Sent a photo";
  if (type === "video") return "Sent a video";
  if (type === "file") return "Sent a file";
  return "";
}

type InboxRow = {
  id: string;
  account_id: string;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  dog_names: string | null;
  last_message_at: string;
  last_body: string | null;
  last_attachment_type: string | null;
  last_from_staff: boolean | null;
  unread: boolean;
  completed_at: string | null;
  member_last_active_at: string | null;
};

/** Trainer inbox: every conversation, most recent first. */
export async function getConversations(): Promise<Conversation[]> {
  const [{ data, error }, unread] = await Promise.all([supabase.rpc("nn_chat_inbox"), getUnreadCounts()]);
  if (error) throw new Error(error.message);
  return ((data ?? []) as InboxRow[]).map((r) => {
    const owner = r.owner_name || r.email || "Owner";
    return {
      id: r.id,
      user: { id: r.account_id, name: owner },
      dogNames: r.dog_names,
      email: r.email,
      memberLastActiveAt: r.member_last_active_at,
      lastMessageAt: r.last_message_at,
      lastMessagePreview: previewFor(r.last_body, r.last_attachment_type),
      unread: r.unread,
      unreadCount: r.unread ? Math.max(1, unread[r.id] ?? 0) : 0,
      status: r.completed_at ? "closed" : "active",
      avatarUrl: r.avatar_url,
      lastMessageFromStaff: !!r.last_from_staff,
      phone: r.phone,
    };
  });
}

/** Owner: their single ongoing conversation with the team (created the first time). */
export async function getMyConversation(): Promise<Conversation> {
  const { data, error } = await supabase.rpc("nn_chat_my_conversation");
  if (error || !data) throw new Error(error?.message ?? "Chat is temporarily unavailable.");
  const row = data as { id: string; account_id: string; last_message_at: string | null; created_at: string };
  return {
    id: row.id,
    user: { id: row.account_id, name: "Nelly & Nova" },
    lastMessageAt: row.last_message_at ?? row.created_at,
    lastMessagePreview: "",
    unread: false,
    status: "active",
  };
}

export async function getConversation(conversationId: string): Promise<Conversation | null> {
  const list = await getConversations();
  return list.find((c) => c.id === conversationId) ?? null;
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return toMessages(data as MessageRow[]);
}

/** Back-up poll alongside Realtime. */
export async function getMessagesSince(conversationId: string, afterIso: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId)
    .gt("created_at", afterIso)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return toMessages(data as MessageRow[]);
}

/** Live: calls back with each new message in this conversation. Returns an unsubscribe. */
export function subscribeToMessages(conversationId: string, onRow: (row: MessageRow) => void): () => void {
  const channel = supabase
    .channel(`messages:${conversationId}:${Date.now()}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (payload) => onRow(payload.new as MessageRow)
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Uploads a picked photo/video/file into the conversation's own folder. */
async function uploadAttachment(conversationId: string, attachment: Attachment): Promise<string> {
  const fromName = attachment.name.split(".").pop();
  const fromMime = attachment.mimeType?.split("/").pop();
  const ext = (fromName && fromName !== attachment.name ? fromName : fromMime || "bin").toLowerCase();
  const path = `${conversationId}/${randomId()}.${ext}`;
  // fetch() reads a local file:// URI without needing another native module.
  const bytes = await (await fetch(attachment.url)).arrayBuffer();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: attachment.mimeType ?? "application/octet-stream" });
  if (error) throw error;
  return path;
}

/** A trainer's reply: ask the website to let the owner know in the app. Best-effort. */
async function notifyOwner(conversationId: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;
  await fetch(new URL("/api/chat/notify", config.siteUrl).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ conversationId }),
  });
}

export async function sendMessage(conversationId: string, body: string, fromStaff: boolean, attachment?: Attachment): Promise<Message> {
  const path = attachment ? await uploadAttachment(conversationId, attachment) : null;
  const { data, error } = await supabase.rpc("nn_chat_send", {
    p_conversation_id: conversationId,
    p_body: body,
    p_attachment_path: path,
    p_attachment_type: attachment?.type ?? null,
    p_attachment_name: attachment?.name ?? null,
  });
  if (error || !data) throw new Error(error?.message ?? "Could not send that.");
  if (fromStaff) notifyOwner(conversationId).catch(() => {});
  const [message] = await toMessages([data as MessageRow]);
  // Keep showing the local copy of what they just sent rather than re-downloading it.
  return attachment ? { ...message, attachment: { ...attachment, url: attachment.url } } : message;
}

export async function setConversationStatus(conversationId: string, status: Conversation["status"]): Promise<void> {
  const { error } = await supabase.rpc("nn_chat_set_completed", {
    p_conversation_id: conversationId,
    p_completed: status === "closed",
  });
  if (error) throw new Error(error.message);
}

export async function markChatRead(conversationId: string, _asStaff?: boolean): Promise<void> {
  await supabase.rpc("nn_chat_mark_read", { p_conversation_id: conversationId });
}

/** "I'm in the chat right now" — every ~30s while an owner's chat is on screen. */
export async function chatHeartbeat(): Promise<void> {
  await supabase.rpc("nn_chat_heartbeat");
}

/**
 * Trainer: how far the owner has got in their chat — when they last read it
 * ("Seen" under our latest message) and last had it open ("In the chat now").
 */
export async function getConversationStatus(
  conversationId: string
): Promise<{ memberLastReadAt: string | null; memberLastActiveAt: string | null } | null> {
  const { data } = await supabase
    .from("conversations")
    .select("member_last_read_at, member_last_active_at")
    .eq("id", conversationId)
    .maybeSingle();
  if (!data) return null;
  return { memberLastReadAt: data.member_last_read_at as string | null, memberLastActiveAt: data.member_last_active_at as string | null };
}

/**
 * Trainer: the owner's open enquiry (a meet & greet request not yet closed),
 * by their account or email — what "Send onboarding link" sends from.
 */
export async function findOpenEnquiry(accountId: string, email: string | null | undefined): Promise<string | null> {
  const open = ["new", "meet_greet_booked", "onboarding"];
  const byAccount = await supabase
    .from("enquiries")
    .select("id")
    .eq("account_id", accountId)
    .in("status", open)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (byAccount.data?.id) return byAccount.data.id as string;
  if (!email) return null;
  const byEmail = await supabase
    .from("enquiries")
    .select("id")
    .ilike("email", email.replace(/[%_\\]/g, (c) => `\\${c}`))
    .in("status", open)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (byEmail.data?.id as string | undefined) ?? null;
}

/**
 * Trainer: "Send onboarding link" — the website's Start onboarding: the join
 * link and Direct Debit set-up, by email and in this chat (it arrives over
 * Realtime like any message), plus a notification.
 */
export async function sendOnboardingLink(enquiryId: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  const res = await fetch(new URL("/api/onboarding/start", config.siteUrl).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ enquiryId }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error || "Couldn't send the onboarding link.");
}
