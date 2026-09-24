import { HOMEWORK_LIBRARY, type LibDrill, type LibPillar } from "./library";

export { categoryDrillCount } from "./library";
export type { DrillBlock, LibCategory, LibDrill, LibPillar } from "./library";

/** Trainer: the drill library (pillars → categories → levels → drills). */
export async function getLibrary(): Promise<LibPillar[]> {
  // TODO(backend): select from homework library tables once they exist.
  return HOMEWORK_LIBRARY;
}

export async function getDrill(id: string): Promise<{ drill: LibDrill; category: string; level: number } | null> {
  for (const pillar of HOMEWORK_LIBRARY)
    for (const category of pillar.categories)
      for (const level of category.levels) {
        const drill = level.drills.find((d) => d.id === id);
        if (drill) return { drill, category: category.name, level: level.level };
      }
  return null;
}
