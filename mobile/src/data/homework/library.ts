/**
 * Homework drill library, organised the way the training is built:
 *   Pillar (Engagement / Skills / Mindset)
 *     → Category (e.g. Luring, Spatial pressure, Sit)
 *       → Level (Level 1, Level 2 …)
 *         → Drills (a short name + a full "how to" description)
 *
 * Live in Supabase (library_categories / library_drills / library_drill_blocks),
 * read in data/homework/index.ts. These are the shapes.
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

/** Total templated drills in a category (across its levels). */
export function categoryDrillCount(category: LibCategory): number {
  return category.levels.reduce((n, l) => n + l.drills.length, 0);
}
