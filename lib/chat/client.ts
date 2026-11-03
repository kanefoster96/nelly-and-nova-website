"use client";

/**
 * Live chat data, from the browser. Reads go through Row Level Security;
 * every write goes through the nn_chat_* functions in
 * supabase/migrations/20261103000000_chat.sql, which check whether the caller
 * is the conversation's member or a trainer. The app uses the same functions.
 */
import { createClient } from "@/lib/supabase/client";
import type {
  ChatMessage,
  ChatMessageRow,
  InboxConversation,
  SendInput,
} from "./types";

let client: ReturnType<typeof createClient> | null = null;
export function chatSupabase() {
  if (!client) client = createClient();
  return client;
}

export const CHAT_BUCKET = "chat-attachments";
const MESSAGE_COLUMNS =
  "id, conversation_id, sender_id, sender_is_staff, sender_name, body, attachment_path, attachment_type, attachment_name, created_at";

export function toChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderIsStaff: row.sender_is_staff,
    senderName: row.sender_name,
    body: row.body ?? "",
    attachmentPath: row.attachment_path,
    attachmentType: row.attachment_type,
    attachmentName: row.attachment_name,
    createdAt: row.created_at,
  };
}

/** The signed-in member's conversation (created the first time). */
export async function getMyConversationId(): Promise<string> {
  const { data, error } = await chatSupabase().rpc("nn_chat_my_conversation");
  if (error || !data) throw new Error(error?.message ?? "Chat is temporarily unavailable.");
  return (data as { id: string }).id;
}

export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await chatSupabase()
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data as ChatMessageRow[]).map(toChatMessage);
}

/** Polling fallback alongside Realtime. */
export async function getMessagesSince(conversationId: string, afterIso: string): Promise<ChatMessage[]> {
  const { data, error } = await chatSupabase()
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId)
    .gt("created_at", afterIso)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as ChatMessageRow[]).map(toChatMessage);
}

export async function sendChatMessage(
  conversationId: string,
  input: SendInput,
  notifyOwner = false
): Promise<{ success: true } | { success: false; error: string }> {
  const { error } = await chatSupabase().rpc("nn_chat_send", {
    p_conversation_id: conversationId,
    p_body: input.body,
    p_attachment_path: input.attachmentPath ?? null,
    p_attachment_type: input.attachmentType ?? null,
    p_attachment_name: input.attachmentName ?? null,
  });
  if (error) {
    console.error("sendChatMessage failed", error);
    return { success: false, error: "Could not send your message — please try again." };
  }
  // A trainer's reply: let the owner know in the app (the route checks it's a trainer).
  if (notifyOwner) void fetch("/api/chat/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId }) }).catch(() => {});
  return { success: true };
}

export async function markChatRead(conversationId: string): Promise<void> {
  await chatSupabase().rpc("nn_chat_mark_read", { p_conversation_id: conversationId });
}

export async function heartbeat(): Promise<void> {
  await chatSupabase().rpc("nn_chat_heartbeat");
}

export async function getUnreadChatCount(): Promise<number> {
  const { data } = await chatSupabase().rpc("nn_chat_unread_count");
  return typeof data === "number" ? data : 0;
}

/** Trainers' names and photos by id, for the avatars on team messages. */
export async function getTeam(): Promise<Record<string, { name: string; avatarUrl: string | null }>> {
  const { data } = await chatSupabase().rpc("nn_chat_team");
  const team: Record<string, { name: string; avatarUrl: string | null }> = {};
  for (const row of (data ?? []) as { id: string; name: string | null; avatar_url: string | null }[]) {
    team[row.id] = { name: row.name ?? "Nelly & Nova", avatarUrl: row.avatar_url };
  }
  return team;
}

export async function getAttachmentUrl(path: string): Promise<string | null> {
  const { data } = await chatSupabase().storage.from(CHAT_BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function uploadAttachment(conversationId: string, file: File): Promise<string | null> {
  const fromName = file.name.split(".").pop();
  const ext = fromName && fromName !== file.name ? fromName.toLowerCase() : "bin";
  const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await chatSupabase()
    .storage.from(CHAT_BUCKET)
    .upload(path, file, { contentType: file.type || undefined });
  if (error) {
    console.error("uploadAttachment failed", error);
    return null;
  }
  return path;
}

// --- trainer side ------------------------------------------------------------

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

export function previewFor(body: string | null, attachmentType: string | null): string {
  if (body) return body;
  if (attachmentType === "image") return "Sent a photo";
  if (attachmentType === "video") return "Sent a video";
  if (attachmentType === "file") return "Sent a file";
  return "";
}

export async function getInbox(): Promise<InboxConversation[]> {
  const { data, error } = await chatSupabase().rpc("nn_chat_inbox");
  if (error) throw new Error(error.message);
  return ((data ?? []) as InboxRow[]).map((r) => ({
    id: r.id,
    userId: r.account_id,
    ownerName: r.owner_name || r.email || "Member",
    email: r.email,
    phone: r.phone,
    avatarUrl: r.avatar_url,
    dogNames: r.dog_names,
    lastMessageAt: r.last_message_at,
    lastMessagePreview: previewFor(r.last_body, r.last_attachment_type),
    lastFromStaff: !!r.last_from_staff,
    unread: r.unread,
    completed: !!r.completed_at,
    memberLastActiveAt: r.member_last_active_at,
  }));
}

export async function setConversationCompleted(conversationId: string, completed: boolean): Promise<boolean> {
  const { error } = await chatSupabase().rpc("nn_chat_set_completed", {
    p_conversation_id: conversationId,
    p_completed: completed,
  });
  return !error;
}

/**
 * Trainer: how far the owner has got in their chat — when they last read it
 * ("Seen" under our latest message) and last had it open ("In the chat now").
 */
export async function getConversationStatus(
  conversationId: string
): Promise<{ memberLastReadAt: string | null; memberLastActiveAt: string | null; completed: boolean } | null> {
  const { data } = await chatSupabase()
    .from("conversations")
    .select("member_last_read_at, member_last_active_at, completed_at")
    .eq("id", conversationId)
    .maybeSingle();
  if (!data) return null;
  return {
    memberLastReadAt: data.member_last_read_at as string | null,
    memberLastActiveAt: data.member_last_active_at as string | null,
    completed: !!data.completed_at,
  };
}

/**
 * Trainer: the owner's open enquiry (a meet & greet request not yet closed),
 * by their account or their email — what "Send onboarding link" sends from.
 */
export async function findOpenEnquiry(accountId: string, email: string | null): Promise<string | null> {
  const supabase = chatSupabase();
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

/** Trainer: "Send onboarding link" — the same as Start onboarding on the Onboarding page. */
export async function sendOnboardingLink(enquiryId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/onboarding/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enquiryId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || "Couldn't send the onboarding link." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't send the onboarding link." };
  }
}
