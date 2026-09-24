import type { Conversation, Message } from "./types";
import { sampleConversations, sampleMessages } from "./sample";

export type { Conversation, Message } from "./types";
export { formatDate, formatTime } from "./format";

/** Trainer inbox: every conversation, most recent first. */
export async function getConversations(): Promise<Conversation[]> {
  // TODO(backend): select * from conversations order by last_message_at desc.
  return [...sampleConversations].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

/** Member: their single ongoing conversation with the team. */
export async function getMyConversation(): Promise<Conversation> {
  // TODO(backend): select * from conversations where user_id = auth.uid() (create if missing).
  // Scaffold assumption shared with the website: the member owns c2.
  return sampleConversations[1];
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  // TODO(backend): select * from messages where conversation_id = $1 order by created_at,
  // plus a Realtime subscription for new rows.
  return sampleMessages[conversationId] ?? [];
}

export async function sendMessage(conversationId: string, body: string, fromStaff: boolean): Promise<Message> {
  // TODO(backend): insert into messages (conversation_id, sender_id, sender_is_staff, body).
  return {
    id: `local-${Date.now()}`,
    conversationId,
    body,
    fromStaff,
    createdAt: new Date().toISOString(),
  };
}
