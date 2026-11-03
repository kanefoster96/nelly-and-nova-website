/**
 * Sample dog profile (the training plan) until the schedule is live. Report
 * cards, homework and skills are real now (data/reports/index.ts).
 */
import type { DogProfile } from "./types";

export const sampleDog: DogProfile = {
  name: "Nova",
  photo: "/placeholders/dog-avatar-01.svg",
  breed: "Fox Red Labrador",
  age: "2 yrs",
  sessions: 8,
  level: 2,
  plan: {
    service: "Full Day Training",
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
