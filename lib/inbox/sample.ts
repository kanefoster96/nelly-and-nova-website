/**
 * Sample data so the scaffold renders. Replace these with real backend reads
 * in lib/inbox/data.ts. Timestamps are fixed ISO strings (deterministic — no
 * `Date.now()` — so server and client render identically).
 */
import type {
  Conversation,
  Message,
  Notification,
  InboxRequest,
} from "./types";

export const sampleConversations: Conversation[] = [
  {
    id: "c1",
    user: { id: "u1", name: "Visitor", isGuest: true },
    lastMessageAt: "2026-08-11T13:48:00Z",
    lastMessagePreview: "Hi! Do you cover the Cullercoats area for Walk & Train?",
    unread: true,
    status: "new",
  },
  {
    id: "c2",
    user: { id: "u2", name: "Rachel T." },
    lastMessageAt: "2026-08-11T12:10:00Z",
    lastMessagePreview: "Perfect, see you Thursday for the meet & greet 🐾",
    unread: false,
    status: "active",
  },
  {
    id: "c3",
    user: { id: "u3", name: "James P." },
    lastMessageAt: "2026-08-10T17:22:00Z",
    lastMessagePreview: "Thanks so much — Nova's recall is so much better!",
    unread: false,
    status: "closed",
  },
];

export const sampleMessages: Record<string, Message[]> = {
  c1: [
    {
      id: "m1",
      conversationId: "c1",
      body: "Hi! Do you cover the Cullercoats area for Walk & Train?",
      fromStaff: false,
      createdAt: "2026-08-11T13:48:00Z",
    },
  ],
  c2: [
    {
      id: "m2",
      conversationId: "c2",
      body: "Hi Rachel — we'd love to help with Nova. Want to book a free meet & greet?",
      fromStaff: true,
      createdAt: "2026-08-11T11:55:00Z",
    },
    {
      id: "m3",
      conversationId: "c2",
      body: "Yes please! Thursday works for us.",
      fromStaff: false,
      createdAt: "2026-08-11T12:05:00Z",
    },
    {
      id: "m4",
      conversationId: "c2",
      body: "Perfect, see you Thursday for the meet & greet 🐾",
      fromStaff: true,
      createdAt: "2026-08-11T12:10:00Z",
    },
  ],
  c3: [
    {
      id: "m5",
      conversationId: "c3",
      body: "Thanks so much — Nova's recall is so much better!",
      fromStaff: false,
      createdAt: "2026-08-10T17:22:00Z",
    },
  ],
};

export const sampleNotifications: Notification[] = [
  {
    id: "n1",
    title: "New booking request",
    body: "Rachel T. requested a Walk & Train weekly membership for Nova.",
    createdAt: "2026-08-11T12:02:00Z",
    actionHref: "/inbox",
    sentByName: "Website",
    readAt: null,
  },
  {
    id: "n2",
    title: "Meet & greet confirmed",
    body: "You confirmed a meet & greet with Rachel T. for Thursday.",
    createdAt: "2026-08-11T12:11:00Z",
    sentByName: "Nelly & Nova",
    readAt: "2026-08-11T12:30:00Z",
  },
];

export const sampleRequests: InboxRequest[] = [
  {
    id: "r1",
    kind: "booking",
    requesterName: "Rachel T.",
    summary: "Walk & Train · Weekly Membership · 1 dog (Nova)",
    createdAt: "2026-08-11T12:02:00Z",
    status: "pending",
    payload: { service: "walk-train", bookingType: "weekly", dogs: 1 },
  },
  {
    id: "r2",
    kind: "meet-greet",
    requesterName: "Visitor",
    summary: "Free meet & greet enquiry · Cullercoats",
    createdAt: "2026-08-11T13:49:00Z",
    status: "pending",
    payload: { area: "Cullercoats" },
  },
];
