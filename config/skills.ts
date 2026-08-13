/**
 * Training skills, grouped into three pillars.
 * --------------------------------------------
 * Every trackable skill sits under one of three pillars — Engagement, Skills
 * and Mindset. A trainer marks each one "learnt" or "to learn" on a dog's
 * profile; the owner only ever sees the level out of the total per pillar.
 * Drills/categories from the homework library get mapped onto these pillars.
 */
export type SkillItem = { id: string; name: string };
export type SkillPillar = { id: string; name: string; blurb: string; drills: SkillItem[] };

export const SKILL_PILLARS: SkillPillar[] = [
  {
    id: "engagement",
    name: "Engagement",
    blurb: "“Does my dog want to train with me?”",
    drills: [
      { id: "eng-name", name: "Responds to their name" },
      { id: "eng-checkin", name: "Checks in on walks" },
      { id: "eng-watch", name: "Eye contact / watch me" },
      { id: "eng-disengage", name: "Disengages from distractions" },
      { id: "eng-play", name: "Engages in play with you" },
    ],
  },
  {
    id: "skills",
    name: "Skills",
    blurb: "“Can my dog do what I ask?”",
    drills: [
      { id: "sk-sit", name: "Sit & down on cue" },
      { id: "sk-stay", name: "Stay / wait" },
      { id: "sk-recall", name: "Reliable recall" },
      { id: "sk-loose", name: "Loose-lead walking" },
      { id: "sk-heel", name: "Heelwork" },
      { id: "sk-place", name: "Place / settle on a mat" },
    ],
  },
  {
    id: "mindset",
    name: "Mindset",
    blurb: "“How does my dog cope outside of training?”",
    drills: [
      { id: "mind-calm", name: "Calm in new places" },
      { id: "mind-frustration", name: "Handles frustration" },
      { id: "mind-noise", name: "Confident with noises" },
      { id: "mind-impulse", name: "Impulse control" },
      { id: "mind-settle", name: "Settles in the home" },
    ],
  },
];

/** Total trackable skills across all pillars. */
export const TOTAL_SKILLS = SKILL_PILLARS.reduce((n, p) => n + p.drills.length, 0);

/** Seeded "learnt" skills per dog so the profile shows progress in the demo. */
export const SAMPLE_LEARNT: Record<string, string[]> = {
  "d-nova": [
    "eng-name", "eng-checkin", "eng-watch",
    "sk-sit", "sk-recall", "sk-loose",
    "mind-settle", "mind-calm",
  ],
  "d-rex": ["eng-name", "sk-sit", "mind-settle"],
};

/** Learnt / total for one pillar, given the dog's learnt set. */
export function pillarProgress(pillar: SkillPillar, learnt: Set<string>): {
  learnt: number;
  total: number;
} {
  return {
    learnt: pillar.drills.filter((d) => learnt.has(d.id)).length,
    total: pillar.drills.length,
  };
}
