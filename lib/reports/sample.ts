/**
 * Sample dog profile + report cards so the scaffold renders. Timestamps are
 * fixed ISO strings (deterministic — no Date.now()). Replace with backend
 * reads in lib/reports/data.ts.
 */
import type { DogProfile, ReportCard } from "./types";

export const sampleDog: DogProfile = {
  name: "Nova",
  photo: "/placeholders/dog-avatar-01.svg",
  breed: "Fox Red Labrador",
  age: "2 yrs",
  sessions: 8,
  level: 2,
  plan: {
    service: "Walk & Train",
    day: "Thursdays",
    dayId: "thu",
    cadence: "weekly",
    note: "Collection 8:00–10:00am · Drop off 4:00–6:00pm",
  },
  skills: [
    { label: "Engagement", level: 4, of: 5 },
    { label: "Loose lead", level: 3, of: 5 },
    { label: "Recall", level: 3, of: 5 },
    { label: "Settling", level: 2, of: 5 },
  ],
};

export const sampleReportCards: ReportCard[] = [
  {
    id: "rc3",
    dogId: "d-nova",
    date: "2026-08-06T16:30:00Z",
    focus: "Loose lead & recall",
    summary:
      "Nova had a brilliant day. We worked around other dogs in the park and built up her recall with distractions. She's starting to check in with the handler on her own.",
    wins: [
      "Held a loose lead past two other dogs",
      "Recalled off a jogger first time",
      "Settled calmly on the mat during lunch",
    ],
    homework: [
      { id: "hw3a", title: "10 min loose-lead practice", detail: "On your normal route, reward every time she's at your side.", done: false },
      { id: "hw3b", title: "3 recalls in the garden daily", detail: "Use a happy voice and a high-value treat.", done: false },
      { id: "hw3c", title: "Place/settle for 5 mins each evening", done: false },
    ],
    comments: [],
    isNew: true,
  },
  {
    id: "rc2",
    dogId: "d-nova",
    date: "2026-07-30T16:30:00Z",
    focus: "Engagement & focus",
    summary:
      "We focused on engagement today — getting Nova to offer attention before we ask. Lots of progress with the 'watch me' cue.",
    wins: ["Offered eye contact without a cue", "Walked past the cafe without pulling"],
    homework: [
      { id: "hw2a", title: "'Watch me' 5 reps before each meal", done: true },
      { id: "hw2b", title: "Practice engagement on your street", detail: "Reward any check-in.", done: true },
    ],
    comments: [
      {
        id: "cm2a",
        author: "owner",
        authorName: "Rachel T.",
        body: "She keeps looking away when there's a cat nearby — any tips?",
        createdAt: "2026-07-31T09:12:00Z",
      },
      {
        id: "cm2b",
        author: "staff",
        authorName: "Nelly & Nova",
        body: "Totally normal! Add distance from the cat and reward the moment she looks back at you. We'll build on this Thursday.",
        createdAt: "2026-07-31T10:02:00Z",
      },
    ],
    isNew: false,
  },
  {
    id: "rc1",
    dogId: "d-nova",
    date: "2026-07-23T16:30:00Z",
    focus: "Settling in",
    summary:
      "First full day! Nova travelled well and got comfortable with the routine. We kept things calm and positive.",
    wins: ["Great in the van", "Made a new dog friend"],
    homework: [{ id: "hw1a", title: "Short settle sessions at home", done: true }],
    comments: [],
    isNew: false,
  },
  // Rex — the account's second dog, with his own cards.
  {
    id: "rcr2",
    dogId: "d-rex",
    date: "2026-08-04T16:30:00Z",
    focus: "Impulse control",
    summary:
      "Rex worked hard on waiting at thresholds and leaving food on the floor. Lots of focus once he settled in.",
    wins: ["Waited at the gate", "Left a dropped treat on cue", "Calm in the van"],
    homework: [
      { id: "hwr2a", title: "Door manners — wait before going out", done: false },
      { id: "hwr2b", title: "'Leave it' 5 reps daily", done: false },
    ],
    comments: [],
    isNew: true,
  },
  {
    id: "rcr1",
    dogId: "d-rex",
    date: "2026-07-28T16:30:00Z",
    focus: "Settling in",
    summary: "Rex's first sessions — building routine and engagement. A confident, keen boy.",
    wins: ["Travelled well", "Offered focus for treats"],
    homework: [{ id: "hwr1a", title: "Short engagement games at home", done: true }],
    comments: [],
    isNew: false,
  },
];

/** Report cards the owner hasn't seen yet — drives the header notification dot. */
export const newReportIds = sampleReportCards
  .filter((r) => r.isNew)
  .map((r) => r.id);

/** New-card ids for one dog — drives the per-dog badge on the profile. */
export function newReportIdsForDog(dogId: string): string[] {
  return sampleReportCards.filter((r) => r.isNew && r.dogId === dogId).map((r) => r.id);
}
