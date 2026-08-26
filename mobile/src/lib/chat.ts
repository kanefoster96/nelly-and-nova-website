/**
 * Real live chat with the trainer — one ongoing conversation per account
 * (see the website's lib/liveChat for the admin/staff side of the same
 * tables). New messages from staff also land here over Realtime.
 */
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type ChatMessage = {
  id: string;
  conversationId: string;
  body: string;
  fromStaff: boolean;
  createdAt: string;
};

function mapMessage(row: {
  id: string;
  conversation_id: string;
  body: string;
  sender_is_staff: boolean;
  created_at: string;
}): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    body: row.body,
    fromStaff: row.sender_is_staff,
    createdAt: row.created_at,
  };
}

export async function getOrCreateMyConversation(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("account_id", user.id)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ account_id: user.id })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "Failed to start conversation");
  return created.id;
}

export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data } = await supabase
    .from("messages")
    .select("id, conversation_id, body, sender_is_staff, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return (data ?? []).map(mapMessage);
}

export async function sendMessage(conversationId: string, body: string): Promise<ChatMessage> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data: row, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: user.id, sender_is_staff: false, body })
    .select("id, conversation_id, body, sender_is_staff, created_at")
    .single();
  if (error || !row) throw new Error(error?.message ?? "Failed to send message");
  return mapMessage(row);
}

/** Live updates for a conversation — new messages from staff, mainly. */
export function subscribeToMessages(
  conversationId: string,
  onInsert: (message: ChatMessage) => void
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`messages-${conversationId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (payload) => onInsert(mapMessage(payload.new as Parameters<typeof mapMessage>[0]))
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}
