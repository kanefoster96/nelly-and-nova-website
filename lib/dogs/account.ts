/**
 * Per-dog profiles for the logged-in account (scaffold).
 * ------------------------------------------------------
 * The account can have more than one dog; each has its own profile. Until the
 * backend is wired, we keep a small sample map keyed by dogId so the profile
 * page can switch between dogs and show each one's own details.
 * TODO(backend): getDogProfile(dogId) → select * from dogs where id = $1.
 */
import type { DogProfile } from "@/lib/reports/types";

export const ACCOUNT_DOG_PROFILES: Record<string, DogProfile> = {
  "d-nova": {
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
  },
  "d-rex": {
    name: "Rex",
    photo: "/placeholders/dog-avatar-02.svg",
    breed: "Border Collie",
    age: "3 yrs",
    sessions: 4,
    level: 1,
    plan: {
      service: "Walk & Train",
      day: "Tuesdays",
      dayId: "tue",
      cadence: "weekly",
      note: "Collection 8:00–10:00am · Drop off 4:00–6:00pm",
    },
    skills: [
      { label: "Engagement", level: 2, of: 5 },
      { label: "Loose lead", level: 2, of: 5 },
      { label: "Recall", level: 1, of: 5 },
      { label: "Settling", level: 3, of: 5 },
    ],
  },
};

/** The active dog's profile, falling back to the server-provided one. */
export function accountDogProfile(dogId: string | undefined, fallback: DogProfile): DogProfile {
  return (dogId && ACCOUNT_DOG_PROFILES[dogId]) || fallback;
}
