/**
 * Practice library maths (pure).
 * ------------------------------
 * Gathers the homework drills a dog has been given (across their report cards)
 * and groups them under the three pillars, sorted lowest level → highest, so
 * the owner can practise between sessions. A drill's pillar/level is looked up
 * by name against the skills + homework-library configs, then by its report-card
 * category name.
 */
import type { ReportCard } from "@/lib/reports/types";
import { SKILL_PILLARS } from "@/config/skills";
import { HOMEWORK_LIBRARY } from "@/config/homeworkLibrary";

export type PracticeDrill = { name: string; level: number };
export type PracticeByPillar = Record<string, PracticeDrill[]>;

// drill name (lowercased) → { pillarId, level }
const NAME_INDEX = new Map<string, { pillar: string; level: number }>();
// category name / alias (lowercased) → pillarId
const CATEGORY_INDEX = new Map<string, string>();

for (const pillar of SKILL_PILLARS) {
  CATEGORY_INDEX.set(pillar.name.toLowerCase(), pillar.id);
  for (const s of pillar.drills) NAME_INDEX.set(s.name.toLowerCase(), { pillar: pillar.id, level: s.level });
}
for (const pillar of HOMEWORK_LIBRARY) {
  CATEGORY_INDEX.set(pillar.name.toLowerCase(), pillar.id);
  for (const cat of pillar.categories) {
    CATEGORY_INDEX.set(cat.name.toLowerCase(), pillar.id);
    // First word too, so "Settle & calm" also matches a "Settle" category.
    CATEGORY_INDEX.set(cat.name.toLowerCase().split(" ")[0], pillar.id);
    for (const lvl of cat.levels) {
      for (const d of lvl.drills) NAME_INDEX.set(d.name.toLowerCase(), { pillar: pillar.id, level: lvl.level });
    }
  }
}
// A couple of aliases for older sample category names.
CATEGORY_INDEX.set("settling", "mindset");

/** Which pillar a report-card category belongs to (by name), if resolvable. */
function pillarForCategory(name: string): string | undefined {
  const key = name.trim().toLowerCase();
  return CATEGORY_INDEX.get(key) ?? CATEGORY_INDEX.get(key.split(" ")[0]);
}

/**
 * The dog's given homework drills, grouped by pillar and sorted by level.
 * Pass `libIndex` (the trainer's live library arrangement, by drill name) so a
 * drill's level here follows any moves the trainer makes in the library.
 */
export function practiceByPillar(
  cards: ReportCard[],
  dogId?: string,
  libIndex?: Map<string, { pillar: string; level: number }>
): PracticeByPillar {
  const out: PracticeByPillar = {};
  for (const p of SKILL_PILLARS) out[p.id] = [];
  const seen = new Set<string>();

  for (const card of cards) {
    if (dogId && card.dogId && card.dogId !== dogId) continue;
    for (const cat of card.homework) {
      const catPillar = pillarForCategory(cat.name);
      for (const drill of cat.drills) {
        const name = drill.name.trim();
        if (!name) continue;
        const byName = libIndex?.get(name.toLowerCase()) ?? NAME_INDEX.get(name.toLowerCase());
        const pillarId = byName?.pillar ?? catPillar;
        if (!pillarId || !out[pillarId]) continue;
        const key = `${pillarId}|${name.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out[pillarId].push({ name, level: byName?.level ?? 1 });
      }
    }
  }

  for (const id of Object.keys(out)) {
    out[id].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }
  return out;
}
