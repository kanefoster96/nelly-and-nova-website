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
  NewRequest,
  Notification,
  UnreadCounts,
} from "./types";
import type { OnboardingEntry, OnboardingStage } from "./onboarding";
import { nextStage } from "./onboarding";
import {
  sampleConversations,
  sampleMessages,
  sampleNotifications,
  sampleRequests,
  sampleOnboarding,
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

/**
 * Create a request from a form submission (contact / booking).
 * Called by the /api/contact and /api/booking routes on submit.
 *
 * SCAFFOLD: there is no shared store yet, so this only logs — submitted
 * requests will start appearing in the inbox once this inserts into the
 * `requests` table (see lib/inbox/schema.sql) behind getRequests().
 */
export async function createRequest(input: NewRequest): Promise<void> {
  // TODO(backend): insert into requests (kind, payload, status='pending', …)
  console.log(
    `[inbox] request received (${input.kind}) from ${input.requesterName} — not persisted (scaffold)`
  );
}

/**
 * Onboarding pipeline (admin only). New meet & greet / contact requests land
 * here and advance stage-by-stage (see lib/inbox/onboarding.ts).
 */
export async function getOnboarding(): Promise<OnboardingEntry[]> {
  // TODO(backend): select * from onboarding order by created_at
  return sampleOnboarding;
}

/**
 * Advance an onboarding entry to the next stage.
 * Called when an admin taps the stage's action button (set up meet & greet,
 * send payment info via GoCardless, mark payment set up, confirm onboarding).
 */
export async function advanceOnboarding(
  id: string,
  from: OnboardingStage
): Promise<OnboardingStage | null> {
  // TODO(backend): update onboarding set stage = $next where id = $1
  // The "Send payment info" step will trigger a GoCardless mandate link that
  // only staff can send; the customer sets up the Direct Debit themselves.
  const next = nextStage(from);
  console.log(
    `[inbox] onboarding ${id}: ${from} → ${next ?? "(complete)"} — not persisted (scaffold)`
  );
  return next;
}

export async function getUnreadCounts(): Promise<UnreadCounts> {
  return {
    chat: sampleConversations.filter((c) => c.unread).length,
    notifications: sampleNotifications.filter((n) => !n.readAt).length,
    requests: sampleRequests.filter((r) => r.status === "pending").length,
  };
}
