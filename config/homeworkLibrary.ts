/**
 * Homework drill library, organised the way the training is built:
 *   Pillar (Engagement / Skills / Mindset)
 *     → Category (e.g. Heeling, Luring, Recall)
 *       → Level (Level 1, Level 2 …)
 *         → Drills (how to practise)
 *
 * Trainers browse this on the dashboard and add drills. Level 1 and Level 2 are
 * templated below to show the shape; add more levels/categories as the library
 * grows. The three pillars mirror config/skills.ts.
 */
export type LibDrill = { id: string; name: string };
export type LibLevel = { level: number; drills: LibDrill[] };
export type LibCategory = { id: string; name: string; levels: LibLevel[] };
export type LibPillar = { id: string; name: string; blurb: string; categories: LibCategory[] };

/** Build helper — stamps stable drill ids from the category/level. */
function cat(id: string, name: string, l1: string[], l2: string[]): LibCategory {
  const drills = (level: number, names: string[]): LibDrill[] =>
    names.map((n, i) => ({ id: `${id}-l${level}-${i + 1}`, name: n }));
  return {
    id,
    name,
    levels: [
      { level: 1, drills: drills(1, l1) },
      { level: 2, drills: drills(2, l2) },
    ],
  };
}

export const HOMEWORK_LIBRARY: LibPillar[] = [
  {
    id: "engagement",
    name: "Engagement",
    blurb: "Choosing to work with you",
    categories: [
      cat(
        "marker-words",
        "Marker words",
        [
          "Charge your marker: say “yes”, then treat — 10 reps, twice a day.",
          "Mark and reward one calm behaviour the dog offers on your walk.",
        ],
        [
          "Use your marker for a behaviour at a short distance, then reward.",
          "Mark a behaviour, delay the treat by 2–3 seconds, then reward.",
        ]
      ),
      cat(
        "name-response",
        "Name response",
        [
          "Say the dog's name in a quiet room; reward the instant they look.",
          "10 name reps before each meal — name, look, treat.",
        ],
        [
          "Say their name with a mild distraction present, reward the look.",
          "Name response from another room — reward coming to find you.",
        ]
      ),
      cat(
        "focus-play",
        "Focus & play",
        [
          "30 seconds of tug, then ask for a sit to restart — builds an on/off switch.",
          "Reward eye contact (“watch me”) for 5 seconds, 5 reps a day.",
        ],
        [
          "Play, pause, and reward the dog re-engaging with you unprompted.",
          "Hold eye contact past a low-level distraction, then release to play.",
        ]
      ),
    ],
  },
  {
    id: "skills",
    name: "Skills",
    blurb: "The practical obedience",
    categories: [
      cat(
        "luring",
        "Luring",
        [
          "Lure a sit and a down with a treat at the nose — 5 reps each.",
          "Lure a 180° turn following the treat, reward at the end.",
        ],
        [
          "Fade the lure: same movement with an empty hand, reward after.",
          "Lure into a stand from a sit and back down, rewarding smoothly.",
        ]
      ),
      cat(
        "heeling",
        "Heeling",
        [
          "5 minutes of heelwork on your usual walk, rewarding every few steps.",
          "10 changes of direction, keeping the dog in the heel position.",
        ],
        [
          "Heel past a mild distraction (a bin, a parked car) and reward focus.",
          "Add a halt: heel, stop, reward an automatic sit at your side.",
        ]
      ),
      cat(
        "recall",
        "Recall",
        [
          "Call the dog back 3 times in the garden with a happy voice and treat.",
          "Recall between two people 2m apart, rewarding each arrival.",
        ],
        [
          "Recall away from a low-level distraction, then release back to it.",
          "Recall on a long line at distance, rewarding a fast return.",
        ]
      ),
      cat(
        "loose-lead",
        "Loose lead",
        [
          "10 minutes of loose-lead walking — stop the moment the lead tightens.",
          "Reward every time the dog chooses to walk at your side unasked.",
        ],
        [
          "Loose lead past another dog across the street, rewarding slack.",
          "Change pace (slow/normal/fast) keeping the lead loose throughout.",
        ]
      ),
    ],
  },
  {
    id: "mindset",
    name: "Mindset",
    blurb: "Calm, confident, resilient",
    categories: [
      cat(
        "settle",
        "Settle & calm",
        [
          "Place/settle on a mat for 5 minutes each evening while you relax.",
          "Reward a calm down-stay while you make a cup of tea.",
        ],
        [
          "Settle on the mat in a busier room, rewarding calmness.",
          "Settle at a café or outside a shop for a few minutes.",
        ]
      ),
      cat(
        "impulse-control",
        "Impulse control",
        [
          "“Leave it” with a treat on the floor — 5 reps daily.",
          "Wait at thresholds — ask for a wait before going through every door.",
        ],
        [
          "“Leave it” with the treat in an open hand, reward from the other hand.",
          "Wait while you place the food bowl down, release to eat.",
        ]
      ),
      cat(
        "confidence",
        "Confidence",
        [
          "Reward calm curiosity toward a novel object at home.",
          "Walk over a new surface (a mat, a grate) and reward.",
        ],
        [
          "Approach and investigate a novel object in a new place, reward.",
          "Reward relaxed body language around a sudden but mild noise.",
        ]
      ),
    ],
  },
];

/** Total templated drills in a category (across its levels). */
export function categoryDrillCount(category: LibCategory): number {
  return category.levels.reduce((n, l) => n + l.drills.length, 0);
}
