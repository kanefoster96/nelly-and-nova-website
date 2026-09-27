/**
 * Sample notifications (based on the website's lib/inbox/sample.ts) so the
 * list renders before the notifications table exists. `actionHref` is an app
 * route here.
 */
import type { Notification } from "@/data/inbox/types";

export const sampleMemberNotifications: Notification[] = [
  {
    id: "n-m1",
    title: "New report card",
    body: "Nova's Thursday session report card is ready — with new homework.",
    createdAt: "2026-08-06T16:35:00Z",
    actionHref: "/homework",
    sentByName: "Nelly & Nova",
    readAt: null,
  },
  {
    id: "n-m2",
    title: "New message",
    body: "Perfect, see you Thursday for the meet & greet 🐾",
    createdAt: "2026-08-11T12:10:00Z",
    actionHref: "/chat",
    sentByName: "Nelly & Nova",
    readAt: null,
  },
  {
    id: "n-m3",
    title: "Liked your post",
    body: "James P. liked “Loose lead win 🎉”.",
    createdAt: "2026-08-11T09:40:00Z",
    actionHref: "/community",
    sentByName: "James P.",
    readAt: "2026-08-11T10:00:00Z",
  },
];

export const sampleTrainerNotifications: Notification[] = [
  {
    id: "n-t1",
    title: "New comment on a report card",
    body: "Rachel T. asked a question about Nova's homework — tap to reply.",
    createdAt: "2026-07-31T09:12:00Z",
    actionHref: "/chat",
    sentByName: "Rachel T.",
    readAt: null,
  },
  {
    id: "n-t2",
    title: "New booking request",
    body: "Rachel T. requested a Walk & Train weekly membership for Nova.",
    createdAt: "2026-08-11T12:02:00Z",
    actionHref: "/schedule",
    sentByName: "Nelly & Nova",
    readAt: null,
  },
  {
    id: "n-t3",
    title: "Meet & greet confirmed",
    body: "You confirmed a meet & greet with Rachel T. for Thursday.",
    createdAt: "2026-08-11T12:11:00Z",
    actionHref: "/schedule",
    sentByName: "Nelly & Nova",
    readAt: "2026-08-11T12:30:00Z",
  },
];
