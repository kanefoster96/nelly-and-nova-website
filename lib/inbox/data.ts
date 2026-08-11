/**
 * Data-access seam for the inbox (chat + notifications + requests).
 * ------------------------------------------------------------------
 * This is the ONE place to swap the scaffold's sample data for a real backend.
 * Per the reference architecture, the intended backend is Supabase:
 *   - getConversations()  → select from `conversations`
 *   - getMessages(id)     → select from `messages` where conversation_id = id
 *   - sendMessage(...)    → insert into `messages` (returns the row)
 *   - getNotifications()  → select from `notifications`
 *   - getRequests()       → select from `requests` where status = 'pending'
 *   - getUnreadCounts()   → three count() queries
 * Add anonymous sign-in for guests, RLS (`auth.uid() = user_id or is_staff()`),
 * Realtime on all three tables, and the Realtime+poll delivery in ChatThread.
 * See lib/inbox/schema.sql for the table shapes.
 *
 * Everything below is async on purpose so the swap to real queries is drop-in.
 */
import type {
  Conversation,
  InboxRequest,
  Message,
  Notification,
  UnreadCounts,
} from "./types";
import {
  sampleConversations,
  sampleMessages,
  sampleNotifications,
  sampleRequests,
} from "./sample";

export async function getConversations(): Promise<Conversation[]> {
  // TODO(backend): select * from conversations order by last_message_at desc
  return sampleConversations;
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  // TODO(backend): select * from messages where conversation_id = $1 order by created_at
  return sampleMessages[conversationId] ?? [];
}

export async function sendMessage(
  conversationId: string,
  body: string,
  fromStaff: boolean
): Promise<Message> {
  // TODO(backend): insert into messages (...) returning *
  // Scaffold: echo a confirmed message back to the caller.
  return {
    id: `local-${conversationId}-${body.length}-${body.slice(0, 8)}`,
    conversationId,
    body,
    fromStaff,
    createdAt: new Date().toISOString(),
  };
}

export async function getNotifications(): Promise<Notification[]> {
  // TODO(backend): select * from notifications where recipient_id is null or = me
  return sampleNotifications;
}

export async function getRequests(): Promise<InboxRequest[]> {
  // TODO(backend): select * from requests where status = 'pending'
  return sampleRequests;
}

export async function getUnreadCounts(): Promise<UnreadCounts> {
  return {
    chat: sampleConversations.filter((c) => c.unread).length,
    notifications: sampleNotifications.filter((n) => !n.readAt).length,
    requests: sampleRequests.filter((r) => r.status === "pending").length,
  };
}
