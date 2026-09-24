/**
 * Sample weekly schedule so the admin views render. Replace with backend reads
 * in lib/schedule/data.ts. Photos reuse the dog-avatar placeholders.
 */
import type { DaySchedule, ScheduledDog } from "./types";

const av = (n: number) =>
  `/placeholders/dog-avatar-${String(n).padStart(2, "0")}.svg`;

const emailFor = (name: string) =>
  `${name.toLowerCase().replace(/[^a-z]/g, "")}@example.com`;

const dog = (
  id: string,
  name: string,
  ownerName: string,
  n: number,
  extra: Partial<ScheduledDog> = {}
): ScheduledDog => ({
  id,
  name,
  ownerName,
  photo: av(n),
  cadence: "weekly",
  status: "permanent",
  email: emailFor(name),
  ...extra,
});

export const sampleWeek: DaySchedule[] = [
  {
    day: "mon",
    capacity: 6,
    dogs: [
      dog("d-ziggy", "Ziggy", "James P.", 2),
      dog("d-bo", "Bo", "Emma W.", 3, { cadence: "alternating", weekParity: "A" }),
      dog("d-rex", "Rex", "Sam H.", 4),
    ],
  },
  {
    day: "tue",
    capacity: 6,
    dogs: [
      dog("d-luna", "Luna", "Priya K.", 5),
      dog("d-milo", "Milo", "Tom B.", 6),
    ],
  },
  {
    day: "wed",
    capacity: 6,
    dogs: [
      dog("d-poppy", "Poppy", "Grace L.", 7),
      dog("d-ollie", "Ollie", "Dan R.", 8),
      dog("d-bella", "Bella", "Kate M.", 9),
      dog("d-coco", "Coco", "Neil P.", 10),
    ],
  },
  {
    day: "thu",
    capacity: 6,
    dogs: [
      dog("d-nova", "Nova", "Rachel T.", 1),
      dog("d-teddy", "Teddy", "Alex W.", 11),
      dog("d-willow", "Willow", "Beth S.", 12, { status: "held" }),
    ],
  },
  {
    day: "fri",
    capacity: 6,
    dogs: [
      dog("d-buddy", "Buddy", "Chris D.", 13),
      dog("d-daisy", "Daisy", "Mia F.", 14),
      dog("d-jack", "Jack", "Owen T.", 15, { cadence: "alternating", weekParity: "B" }),
    ],
  },
  {
    day: "sat",
    capacity: 4,
    dogs: [dog("d-rosie", "Rosie", "Lucy G.", 16)],
  },
  { day: "sun", capacity: 0, dogs: [] },
];
