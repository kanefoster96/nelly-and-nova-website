/**
 * Training skills, grouped into three pillars.
 * --------------------------------------------
 * Every trackable skill sits under one of three pillars — Engagement, Skills
 * and Mindset. A trainer marks each one "learnt" or "to learn" on a dog's
 * profile; the owner only ever sees the level out of the total per pillar.
 * Drills/categories from the homework library get mapped onto these pillars.
 */
export type SkillItem = { id: string; name: string; level: number };
export type SkillPillar = { id: string; name: string; blurb: string; drills: SkillItem[] };

export const SKILL_PILLARS: SkillPillar[] = [
  {
    id: "engagement",
    name: "Engagement",
    blurb: "“Does my dog want to train with me?”",
    drills: [
      { id: "eng-name", name: "Responds to their name", level: 1 },
      { id: "eng-checkin", name: "Checks in on walks", level: 1 },
      { id: "eng-watch", name: "Eye contact / watch me", level: 1 },
      { id: "eng-disengage", name: "Disengages from distractions", level: 2 },
      { id: "eng-play", name: "Engages in play with you", level: 2 },
    ],
  },
  {
    id: "skills",
    name: "Skills",
    blurb: "“Can my dog do what I ask?”",
    drills: [
      { id: "sk-sit", name: "Sit & down on cue", level: 1 },
      { id: "sk-stay", name: "Stay / wait", level: 1 },
      { id: "sk-recall", name: "Reliable recall", level: 1 },
      { id: "sk-loose", name: "Loose-lead walking", level: 2 },
      { id: "sk-heel", name: "Heelwork", level: 2 },
      { id: "sk-place", name: "Place / settle on a mat", level: 2 },
    ],
  },
  {
    id: "mindset",
    name: "Mindset",
    blurb: "“How does my dog cope outside of training?”",
    drills: [
      { id: "mind-calm", name: "Calm in new places", level: 1 },
      { id: "mind-settle", name: "Settles in the home", level: 1 },
      { id: "mind-frustration", name: "Handles frustration", level: 2 },
      { id: "mind-noise", name: "Confident with noises", level: 2 },
      { id: "mind-impulse", name: "Impulse control", level: 2 },
    ],
  },
];

/** The distinct levels defined in a pillar, ascending (e.g. [1, 2]). */
export function pillarLevels(pillar: SkillPillar): number[] {
  return [...new Set(pillar.drills.map((d) => d.level))].sort((a, b) => a - b);
}

/** Total trackable skills across all pillars. */
export const TOTAL_SKILLS = SKILL_PILLARS.reduce((n, p) => n + p.drills.length, 0);

/**
 * Every dog starts with no skills ticked — the trainer marks them off as the
 * dog learns each one (from the Status panel on the dashboard), which is what
 * drives the level shown on the profile. Empty by design.
 */
export const SAMPLE_LEARNT: Record<string, string[]> = {};

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

/**
 * A pillar's level. Every dog starts on Level 1; once every skill at their
 * current level is learnt they move up a level (so Level 1 complete → Level 2).
 * Progression stops at the first level that isn't fully done.
 */
export function pillarLevel(pillar: SkillPillar, learnt: Set<string>): number {
  let level = 1;
  for (const lvl of pillarLevels(pillar)) {
    const done = pillar.drills
      .filter((d) => d.level === lvl)
      .every((d) => learnt.has(d.id));
    if (!done) break;
    level = lvl + 1;
  }
  return level;
}

/**
 * The account level shown on the profile — the average of the three pillar
 * levels, rounded up. Rounding up keeps it fair: a dog powering ahead on Skills
 * and Engagement still gets the higher level even if Mindset (which takes
 * longer) lags behind.
 */
export function accountLevel(learnt: Set<string>): number {
  const levels = SKILL_PILLARS.map((p) => pillarLevel(p, learnt));
  return Math.ceil(levels.reduce((a, b) => a + b, 0) / levels.length);
}
