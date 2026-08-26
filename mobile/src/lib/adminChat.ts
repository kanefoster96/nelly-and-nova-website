/**
 * Coach-side chat — the admin half of the same conversations/messages
 * tables lib/chat.ts uses for a member. getMessages/subscribeToMessages are
 * shared (conversation-scoped, no staff-specific logic); this file adds the
 * admin-only pieces: listing every conversation, and sending as staff.
 */
import { supabase } from "@/lib/supabase";
import { notifyMember } from "@/lib/adminNotify";
import type { ChatMessage } from "@/lib/chat";

export type AdminConversation = {
  id: string;
  accountId: string;
  ownerName: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  unread: boolean;
};

type ConversationRow = {
  id: string;
  account_id: string;
  last_message_at: string | null;
  staff_last_read_at: string | null;
  created_at: string;
  owner: { owner_name: string | null } | { owner_name: string | null }[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function getConversationsForAdmin(): Promise<AdminConversation[]> {
  const { data: convos } = await supabase
    .from("conversations")
    .select(
      "id, account_id, last_message_at, staff_last_read_at, created_at, owner:profiles!conversations_account_id_fkey(owner_name)"
    )
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (!convos || convos.length === 0) return [];

  const ids = convos.map((c) => c.id);
  const { data: recent } = await supabase
    .from("messages")
    .select("conversation_id, body, sender_is_staff, created_at")
    .in("conversation_id", ids)
    .order("created_at", { ascending: false });

  const previewByConvo = new Map<string, { body: string; sender_is_staff: boolean; created_at: string }>();
  for (const m of recent ?? []) {
    if (!previewByConvo.has(m.conversation_id)) previewByConvo.set(m.conversation_id, m);
  }

  return (convos as ConversationRow[]).map((c) => {
    const preview = previewByConvo.get(c.id);
    const unread =
      !!preview &&
      !preview.sender_is_staff &&
      (!c.staff_last_read_at || new Date(c.staff_last_read_at) < new Date(preview.created_at));

    return {
      id: c.id,
      accountId: c.account_id,
      ownerName: one(c.owner)?.owner_name || "Member",
      lastMessageAt: c.last_message_at ?? preview?.created_at ?? c.created_at,
      lastMessagePreview: preview?.body ?? "No messages yet",
      unread,
    };
  });
}

export async function sendStaffMessage(conversationId: string, accountId: string, body: string): Promise<ChatMessage> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data: row, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: user.id, sender_is_staff: true, body })
    .select("id, conversation_id, body, sender_is_staff, created_at")
    .single();
  if (error || !row) throw new Error(error?.message ?? "Failed to send message");

  await notifyMember({
    accountId,
    kind: "chat_message",
    title: "New message from Nelly & Nova",
    body: body.length > 120 ? `${body.slice(0, 117)}...` : body,
  });

  return {
    id: row.id,
    conversationId: row.conversation_id,
    body: row.body,
    fromStaff: row.sender_is_staff,
    createdAt: row.created_at,
  };
}

export async function markConversationReadByStaff(conversationId: string): Promise<void> {
  await supabase.from("conversations").update({ staff_last_read_at: new Date().toISOString() }).eq("id", conversationId);
}
