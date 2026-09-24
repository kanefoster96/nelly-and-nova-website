/**
 * Sample chat data (copied from the website's lib/inbox/sample.ts) so the app
 * renders before the inbox tables exist. Replace via src/data/inbox/index.ts.
 */
import type { Conversation, Message } from "./types";

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
    // Staff see the owner + their dog(s) so they know exactly who they're
    // talking to — see accountAdminLabel() in lib/auth/session.ts.
    // TODO(backend): derive the conversation title from owner + account dogs.
    id: "c2",
    user: { id: "u2", name: "Rachel T. (Nova & Rex)" },
    lastMessageAt: "2026-08-11T12:10:00Z",
    lastMessagePreview: "Perfect, see you Thursday for the meet & greet 🐾",
    unread: false,
    status: "active",
  },
  {
    id: "c3",
    user: { id: "u3", name: "James P. (Rex)" },
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
