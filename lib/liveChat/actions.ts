"use server";

/**
 * Real chat writes — Server Actions so client components (the chat thread)
 * can call them directly while still running with the admin's authenticated,
 * RLS-scoped server client. See lib/liveChat/queries.ts for the read side.
 */
import { createClient } from "@/lib/supabase/server";
import { notifyMember } from "@/lib/push/notify";
import type { Message } from "@/lib/inbox/types";

export async function sendStaffMessage(conversationId: string, body: string): Promise<Message> {
  const supabase = await createClient();
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

  const { data: conversation } = await supabase
    .from("conversations")
    .select("account_id")
    .eq("id", conversationId)
    .single();

  if (conversation) {
    await notifyMember({
      accountId: conversation.account_id,
      kind: "chat_message",
      title: "New message from Nelly & Nova",
      body: body.length > 120 ? `${body.slice(0, 117)}...` : body,
    });
  }

  return {
    id: row.id,
    conversationId: row.conversation_id,
    body: row.body,
    fromStaff: row.sender_is_staff,
    createdAt: row.created_at,
  };
}

export async function markConversationReadByStaff(conversationId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("conversations")
    .update({ staff_last_read_at: new Date().toISOString() })
    .eq("id", conversationId);
}

/** Ensure an account has a conversation row (member's first app launch, or
 *  an admin starting a thread with someone who's never messaged in). */
export async function getOrCreateConversation(accountId: string): Promise<string> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("account_id", accountId)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ account_id: accountId })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "Failed to start conversation");
  return created.id;
}
