/**
 * Practice library maths (pure).
 * ------------------------------
 * Gathers the homework drills a dog has been given (across their report cards)
 * and groups them under the three pillars, sorted lowest level → highest, so
 * the owner can practise between sessions. A drill's pillar and level come
 * from the library drill it was picked from (its `ref`), else its own pillar,
 * else a library drill or category with the same name.
 */
import type { ReportCard } from "@/lib/reports/types";
import {
  findLibraryDrill,
  libraryCategories,
  libraryNameIndex,
  type LibraryOverlay,
} from "@/lib/homework-library/store";

export type PracticeDrill = { name: string; level: number; ref: string | null };
export type PracticeByPillar = Record<string, PracticeDrill[]>;

/** The dog's given homework drills, grouped by pillar and sorted by level. */
export function practiceByPillar(
  cards: ReportCard[],
  dogId: string | undefined,
  library: LibraryOverlay,
  pillarIds: string[]
): PracticeByPillar {
  const out: PracticeByPillar = {};
  for (const p of pillarIds) out[p] = [];
  const byName = libraryNameIndex(library);
  const categoryPillar = new Map<string, string>();
  for (const c of libraryCategories(library)) {
    categoryPillar.set(c.name.toLowerCase(), c.pillarId);
    categoryPillar.set(c.name.toLowerCase().split(" ")[0], c.pillarId);
  }
  for (const p of library.pillars) categoryPillar.set(p.name.toLowerCase(), p.id);
  const seen = new Set<string>();

  for (const card of cards) {
    if (card.status === "draft") continue;
    if (dogId && card.dogId && card.dogId !== dogId) continue;
    for (const cat of card.homework) {
      const key = cat.name.trim().toLowerCase();
      const catPillar = categoryPillar.get(key) ?? categoryPillar.get(key.split(" ")[0]);
      for (const drill of cat.drills) {
        const name = drill.name.trim();
        if (!name) continue;
        const lib = findLibraryDrill(library, drill.ref);
        const named = byName.get(name.toLowerCase());
        const pillarId = lib?.pillarId ?? drill.pillar ?? named?.pillar ?? catPillar;
        if (!pillarId || !out[pillarId]) continue;
        const dedupe = `${pillarId}|${(lib?.drill.id ?? name).toLowerCase()}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        out[pillarId].push({ name, level: lib?.drill.level ?? named?.level ?? 1, ref: lib?.drill.id ?? null });
      }
    }
  }

  for (const id of Object.keys(out)) {
    out[id].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }
  return out;
}
