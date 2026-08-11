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
import type { OnboardingEntry } from "./onboarding";

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
    id: "n0",
    title: "New report card",
    body: "Nova's Thursday session report card is ready — with new homework.",
    createdAt: "2026-08-06T16:35:00Z",
    actionHref: "/profile/reports",
    sentByName: "Nelly & Nova",
    readAt: null,
  },
  {
    id: "n-admin",
    title: "New comment on a report card",
    body: "Rachel T. asked a question about Nova's homework — tap to reply.",
    createdAt: "2026-07-31T09:12:00Z",
    actionHref: "/profile/reports",
    sentByName: "Rachel T.",
    readAt: null,
  },
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
    email: "rachel@example.com",
    phone: "07123 456789",
    summary: "Walk & Train · Weekly Membership · 1 dog",
    createdAt: "2026-08-11T12:02:00Z",
    status: "pending",
    details: [
      { label: "Name", value: "Rachel T." },
      { label: "Email", value: "rachel@example.com" },
      { label: "Phone", value: "07123 456789" },
      { label: "Address", value: "14 Beach Rd, Whitley Bay, NE26" },
      { label: "Found us via", value: "website" },
      { label: "Service", value: "Walk & Train" },
      { label: "Booking type", value: "Weekly Membership" },
      { label: "Dogs", value: "1" },
      { label: "Estimated price", value: "£60 per week" },
      { label: "Dog's name", value: "Nova" },
      { label: "Breed", value: "Fox Red Labrador" },
      { label: "Gender", value: "female" },
      { label: "Age", value: "2 years" },
      { label: "With other dogs", value: "Friendly, a little over-excited" },
      { label: "With other people", value: "Loves everyone" },
      { label: "Needs help with", value: "Loose lead walking and recall" },
      { label: "Allergies", value: "None" },
      { label: "Lead / tools", value: "Harness and a standard lead" },
      { label: "Trusts our guidance", value: "yes" },
    ],
  },
  {
    id: "r2",
    kind: "contact",
    requesterName: "Website visitor",
    email: "visitor@example.com",
    summary: "Hi! Do you cover the Cullercoats area for Walk & Train?",
    createdAt: "2026-08-11T13:49:00Z",
    status: "pending",
    details: [
      { label: "Name", value: "—" },
      { label: "Email", value: "visitor@example.com" },
      { label: "Phone", value: "—" },
      { label: "Message", value: "Hi! Do you cover the Cullercoats area for Walk & Train? We have a 1 year old cocker spaniel who pulls a lot on the lead." },
    ],
  },
];

export const sampleOnboarding: OnboardingEntry[] = [
  {
    id: "o1",
    name: "Rachel T.",
    dogName: "Nova",
    service: "Walk & Train · Weekly Membership",
    email: "rachel@example.com",
    phone: "07123 456789",
    stage: "new",
    createdAt: "2026-08-11T12:02:00Z",
  },
  {
    id: "o2",
    name: "James P.",
    dogName: "Ziggy",
    service: "Walk & Train · One Off",
    email: "james@example.com",
    phone: "07234 567890",
    stage: "booked",
    createdAt: "2026-08-09T09:00:00Z",
  },
  {
    id: "o3",
    name: "Emma W.",
    dogName: "Bo",
    service: "1-1 Training",
    email: "emma@example.com",
    phone: "07345 678901",
    paymentLink: "https://pay.gocardless.com/setup/nn-emma-bo",
    stage: "payment-sent",
    createdAt: "2026-08-05T14:00:00Z",
  },
];
