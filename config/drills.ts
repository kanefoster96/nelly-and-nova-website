/**
 * Homework drill library.
 * -----------------------
 * A growing library of training categories and the drills under each. A drill
 * is an explanation of how to practise a specific skill. When building a report
 * card's homework, the trainer picks a category and a drill from here (or types
 * a custom one). Add to this list as the library grows.
 */
export type LibraryCategory = { name: string; drills: string[] };

export const DRILL_LIBRARY: LibraryCategory[] = [
  {
    name: "Heeling",
    drills: [
      "Practise 5 minutes of heelwork on your usual walk, rewarding every few steps while they're at your side.",
      "Do 10 changes of direction, keeping them in the heel position as you turn.",
      "Heel past a mild distraction (a bin, a parked car) and reward focus.",
    ],
  },
  {
    name: "Recall",
    drills: [
      "Call them back 3 times in the garden with a happy voice and a high-value treat.",
      "Recall away from a low-level distraction, then release them back to it as the reward.",
    ],
  },
  {
    name: "Loose lead",
    drills: [
      "10 minutes of loose-lead walking — stop the moment the lead goes tight, reward when it softens.",
      "Reward every time they choose to walk at your side without being asked.",
    ],
  },
  {
    name: "Marker words",
    drills: [
      "Charge your marker: say “yes”, then treat — 10 reps, twice a day.",
      "Mark and reward one calm behaviour they offer on your walk.",
    ],
  },
  {
    name: "Settle",
    drills: [
      "Place/settle on a mat for 5 minutes each evening while you relax.",
      "Reward a calm down-stay while you make a cup of tea.",
    ],
  },
  {
    name: "Impulse control",
    drills: [
      "“Leave it” with a treat on the floor — 5 reps daily.",
      "Wait at thresholds — ask for a wait before going through every door.",
    ],
  },
];

/** Library drills for a category name (case-insensitive), if it's in the library. */
export function drillsForCategory(name: string): string[] {
  const key = name.trim().toLowerCase();
  return DRILL_LIBRARY.find((c) => c.name.toLowerCase() === key)?.drills ?? [];
}
