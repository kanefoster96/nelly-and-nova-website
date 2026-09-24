/**
 * Homework drill library, organised the way the training is built:
 *   Pillar (Engagement / Skills / Mindset)
 *     → Category (e.g. Luring, Spatial pressure, Sit)
 *       → Level (Level 1, Level 2 …)
 *         → Drills (a short name + a full "how to" description)
 *
 * Trainers browse this on the dashboard, reorder the drills and build the level
 * path. Each drill has a short name (shown on the card) and a description (shown
 * when the card is opened). Level 1 and Level 2 are templated to show the shape.
 */
/**
 * A drill's page is built from ordered content blocks — headings, paragraphs,
 * photos and videos — so it reads like a little blog post.
 */
export type DrillBlock =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "image"; url: string }
  | { id: string; type: "video"; url: string };

export type LibDrill = { id: string; name: string; blocks: DrillBlock[] };
export type LibLevel = { level: number; drills: LibDrill[] };
export type LibCategory = { id: string; name: string; levels: LibLevel[] };
export type LibPillar = { id: string; name: string; blurb: string; categories: LibCategory[] };

/** [name, how-to paragraph] pairs for a level. */
type Pair = [string, string];

/** Build helper — stamps stable drill ids; the how-to becomes a paragraph block. */
function cat(id: string, name: string, l1: Pair[], l2: Pair[]): LibCategory {
  const drills = (level: number, pairs: Pair[]): LibDrill[] =>
    pairs.map(([n, d], i) => {
      const drillId = `${id}-l${level}-${i + 1}`;
      return {
        id: drillId,
        name: n,
        blocks: d ? [{ id: `${drillId}-p1`, type: "paragraph" as const, text: d }] : [],
      };
    });
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
        "ready",
        "Ready",
        [
          ["Introduce the ready cue", "Say “ready?” in a happy voice, then immediately reward. Repeat 10 times so the word predicts good things and switches your dog on."],
          ["Ready before meals", "Ask “ready?” just before putting the food bowl down. Reward the focus, then release to eat."],
        ],
        [
          ["Ready with movement", "Say “ready?” then take a few steps; reward your dog for coming with you and staying engaged."],
          ["Ready near a distraction", "Use the ready cue with a low-level distraction nearby; reward them for choosing you."],
        ]
      ),
      cat(
        "finish",
        "Finish",
        [
          ["Lure to your side", "Lure your dog around behind you into a sit at your left side. Reward in position. 5 reps."],
          ["Add the word “finish”", "Say “finish”, then lure into position and reward. Repeat until the word starts the movement."],
        ],
        [
          ["Finish without a lure", "Say “finish” and use just a hand signal; reward the tuck into position."],
          ["Finish from in front", "With your dog sitting in front of you, cue “finish” so they swing round to your side."],
        ]
      ),
      cat(
        "yes-marker",
        "Yes marker",
        [
          ["Charge the marker", "Say “yes”, then treat — 10 reps, twice a day — so “yes” always means a reward is coming."],
          ["Mark a known behaviour", "Ask for a sit; the instant they sit, say “yes” and reward."],
        ],
        [
          ["Mark then delay", "Say “yes”, pause 2–3 seconds, then reward — building a gap between the marker and the treat."],
          ["Mark a free choice", "Catch and mark a good behaviour your dog offers on a walk (a check-in, a sit)."],
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
          ["How to hold a treat", "Hold the treat flat against your fingers with your thumb so your dog can smell it but not snatch it. Keep your hand relaxed and lead their nose."],
          ["Lure a sit", "With the treat at your dog’s nose, slowly raise it up over their head. As their nose goes up, their bottom goes down. Reward the sit."],
        ],
        [
          ["Lure a down", "From a sit, lure the treat straight down between their paws, then out along the floor. Reward the down."],
          ["Fade the lure", "Make the same movement with an empty hand and reward from the other hand — the food comes after, not as a bribe."],
        ]
      ),
      cat(
        "spatial-pressure",
        "Spatial pressure",
        [
          ["Step in, step out", "Take a calm step toward your dog to ask them to move back a step, then step away to release the pressure. Reward the movement."],
          ["Body block a threshold", "Use your body to calmly block a doorway; reward your dog for waiting rather than barging through."],
        ],
        [
          ["Pressure to position", "Use a small step of pressure to guide your dog into a sit or back to your side without a lure."],
          ["Release on a loose lead", "Use gentle pressure and release on the lead to show your dog where to be; reward the slack."],
        ]
      ),
      cat(
        "sit",
        "Sit",
        [
          ["Capture a sit", "Wait for your dog to sit on their own; the moment they do, mark and reward. Repeat so sitting earns rewards."],
          ["Add the cue", "Say “sit” just as they begin to sit, then reward — building the word onto the action."],
        ],
        [
          ["Sit at a distance", "Ask for a sit from a step or two away; reward them for staying put."],
          ["Sit with a distraction", "Ask for a sit with a mild distraction present; reward the focus."],
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
        "settling",
        "Settling",
        [
          ["Settle on a mat", "Reward your dog for lying calmly on a mat for a few minutes while you relax. Build the duration up slowly."],
          ["Calm on cue", "Reward a relaxed down-stay while you make a cup of tea; keep the energy low and quiet."],
        ],
        [
          ["Settle in a busy room", "Practise the mat settle somewhere busier at home; reward calmness."],
          ["Settle out and about", "Settle at a café or outside a shop for a few minutes; reward staying relaxed."],
        ]
      ),
      cat(
        "arousal",
        "Arousal",
        [
          ["Up and down game", "Do a few seconds of tug, then ask for a sit to stop. Reward the “off switch” — this teaches your dog to come back down from excitement."],
          ["Sniffing to settle", "Scatter a few treats in the grass after play so your dog can sniff and bring their arousal down."],
        ],
        [
          ["Recover faster", "After a burst of play, ask for calm and reward how quickly they settle."],
          ["Arousal around dogs", "At a distance from another dog, reward your dog for staying under threshold and disengaging."],
        ]
      ),
      cat(
        "triggers",
        "Triggers",
        [
          ["Find the distance", "Work out how far from a trigger your dog can stay calm, and reward relaxed behaviour at that distance."],
          ["Mark the trigger", "The moment your dog notices the trigger calmly, mark and reward — so it starts to predict good things."],
        ],
        [
          ["Close the gap slowly", "Over several sessions, reduce the distance to the trigger a little at a time, keeping your dog calm."],
          ["Disengage from a trigger", "Reward your dog for looking away from the trigger and back to you."],
        ]
      ),
    ],
  },
];

/** Total templated drills in a category (across its levels). */
export function categoryDrillCount(category: LibCategory): number {
  return category.levels.reduce((n, l) => n + l.drills.length, 0);
}
