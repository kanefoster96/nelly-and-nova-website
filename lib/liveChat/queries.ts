/**
 * Real chat reads — backs the new /admin/chat page. Separate from
 * lib/inbox/data.ts, which stays sample-data for the legacy /messages and
 * /inbox scaffold. See lib/liveChat/actions.ts for the write side.
 */
import { createClient } from "@/lib/supabase/server";
import type { Conversation, Message } from "@/lib/inbox/types";

type ConversationRow = {
  id: string;
  account_id: string;
  last_message_at: string | null;
  staff_last_read_at: string | null;
  created_at: string;
  owner: { owner_name: string | null } | { owner_name: string | null }[] | null;
};

function ownerName(owner: ConversationRow["owner"]): string {
  const row = Array.isArray(owner) ? owner[0] : owner;
  return row?.owner_name || "Member";
}

/** Every account's conversation, newest activity first, admin's unread state. */
export async function getConversationsForAdmin(): Promise<Conversation[]> {
  const supabase = await createClient();
  const { data: convos } = await supabase
    .from("conversations")
    .select("id, account_id, last_message_at, staff_last_read_at, created_at, owner:profiles!conversations_account_id_fkey(owner_name)")
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
      user: { id: c.account_id, name: ownerName(c.owner) },
      lastMessageAt: c.last_message_at ?? preview?.created_at ?? c.created_at,
      lastMessagePreview: preview?.body ?? "No messages yet",
      unread,
      status: preview ? "active" : "new",
    };
  });
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, conversation_id, body, sender_is_staff, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((m) => ({
    id: m.id,
    conversationId: m.conversation_id,
    body: m.body,
    fromStaff: m.sender_is_staff,
    createdAt: m.created_at,
  }));
}
