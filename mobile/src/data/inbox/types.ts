/**
 * Inbox domain types — chat + notifications + requests.
 * These mirror the suggested minimal schema (see lib/inbox/schema.sql) so the
 * UI is ready for a real backend (Supabase/Postgres) to slot in behind
 * lib/inbox/data.ts without touching components.
 */

export type Participant = {
  id: string;
  name: string;
  /** Anonymous visitor (signed in anonymously) vs a known member. */
  isGuest?: boolean;
};

/** One row per person — everyone has a single ongoing conversation. */
export type Conversation = {
  id: string;
  user: Participant;
  lastMessageAt: string; // ISO
  lastMessagePreview: string;
  unread: boolean;
  /** Simple buckets for ordering the inbox (no claim/assign concept). */
  status: "new" | "active" | "closed";
};

export type Attachment = { name: string; type: string; url: string };

export type Message = {
  id: string;
  conversationId: string;
  body: string;
  /** Which side sent it — staff (the business) or the visitor/member. */
  fromStaff: boolean;
  createdAt: string; // ISO
  /** Optimistic message not yet confirmed by the backend. */
  pending?: boolean;
  attachment?: Attachment;
};

/** One-way inbox item. recipientId null = broadcast, set = targeted. */
export type Notification = {
  id: string;
  title: string;
  body: string;
  createdAt: string; // ISO
  actionHref?: string;
  sentByName?: string;
  recipientId?: string | null;
  readAt?: string | null;
};

export type RequestStatus = "pending" | "approved" | "rejected";

/** One submitted field, shown in the request detail view. */
export type RequestDetail = { label: string; value: string };

/** Structured form submission (contact / booking) awaiting review. */
export type InboxRequest = {
  id: string;
  /** Discriminator: "contact" | "booking" | "meet-greet" — picks the shape. */
  kind: string;
  requesterName: string;
  summary: string;
  createdAt: string; // ISO
  status: RequestStatus;
  /** Used by the reply actions. */
  email?: string;
  phone?: string;
  /** Ordered list of what the customer entered into the form. */
  details: RequestDetail[];
};

/** Everything needed to create a request, minus server-assigned fields. */
export type NewRequest = Omit<InboxRequest, "id" | "createdAt" | "status">;

export type UnreadCounts = {
  chat: number;
  notifications: number;
  requests: number;
};
