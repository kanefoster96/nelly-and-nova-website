/**
 * Sample community posts so the feed renders before the backend exists.
 * Based on the website's lib/community/sample.ts.
 */
import type { Post } from "./types";

export const sampleCommunityPosts: Post[] = [
  {
    id: "p1",
    authorId: "team",
    authorName: "Nelly & Nova",
    authorIsTrainer: true,
    pinned: true,
    title: "Welcome to the pack!",
    body: "This is our little community space — share your wins, photos and videos, ask questions and cheer each other on. Be kind, keep it doggy, and have fun. 🐶",
    media: [],
    createdAt: "2026-08-01T10:00:00Z",
    likeCount: 21,
    likedByMe: false,
    comments: [],
  },
  {
    id: "p3",
    authorId: "u2",
    authorName: "Nova & Rex",
    authorAvatarUrl: "/placeholders/dog-avatar-01.svg",
    authorDogs: [
      { name: "Nova", level: 2 },
      { name: "Rex", level: 1 },
    ],
    title: "Loose lead win 🎉",
    body: "Nova walked the whole seafront on a loose lead this morning — past two other dogs and a jogger! All that homework is paying off. Thank you Charlotte 🐾",
    media: [{ type: "image", url: "/placeholders/dog-1.svg" }],
    createdAt: "2026-08-11T08:20:00Z",
    likeCount: 12,
    likedByMe: false,
    comments: [
      {
        id: "c1",
        authorId: "team",
        authorName: "Nelly & Nova",
        body: "Amazing progress — she's really checking in with you now. Keep it up!",
        createdAt: "2026-08-11T09:05:00Z",
      },
    ],
  },
  {
    id: "p2",
    authorId: "u3",
    authorName: "James P.",
    authorAvatarUrl: "/placeholders/dog-avatar-02.svg",
    body: "Anyone else's pup obsessed with the beach at Tynemouth? Rex could stay here all day. Any tips for a solid recall around all the distractions?",
    media: [
      { type: "image", url: "/placeholders/dog-2.svg" },
      { type: "image", url: "/placeholders/dog-3.svg" },
    ],
    createdAt: "2026-08-09T17:40:00Z",
    likeCount: 6,
    likedByMe: true,
    comments: [],
  },
];
