import { supabase } from "@/lib/supabase";

import type { DrillBlock, LibCategory, LibDrill, LibPillar } from "./library";

export { categoryDrillCount } from "./library";
export type { DrillBlock, LibCategory, LibDrill, LibPillar } from "./library";

/**
 * The drill library — live from Supabase, the same tables the website's
 * trainer library edits (lib/homework-library/store.ts). Everyone signed in
 * reads it: members open a drill from their homework, trainers browse it.
 */

const PILLARS = [
  { id: "engagement", name: "Engagement", blurb: "Choosing to work with you" },
  { id: "skills", name: "Skills", blurb: "The practical obedience" },
  { id: "mindset", name: "Mindset", blurb: "Calm, confident, resilient" },
];

type BlockRow = { id: string; type: DrillBlock["type"]; text: string | null; url: string | null; sort_order: number };

function toBlocks(rows: BlockRow[] | null): DrillBlock[] {
  return [...(rows ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((b) => (b.type === "image" || b.type === "video" ? { id: b.id, type: b.type, url: b.url ?? "" } : { id: b.id, type: b.type, text: b.text ?? "" }));
}

/** Pillars → categories → levels → drills. */
export async function getLibrary(): Promise<LibPillar[]> {
  const { data, error } = await supabase
    .from("library_categories")
    .select("id, pillar, slug, name, sort_order, library_drills(id, name, level, sort_order, library_drill_blocks(id, type, text, url, sort_order))")
    .order("sort_order");
  if (error) throw error;
  type Row = { id: string; pillar: string; name: string; sort_order: number; library_drills: { id: string; name: string; level: number; sort_order: number; library_drill_blocks: BlockRow[] | null }[] | null };
  const rows = (data ?? []) as unknown as Row[];
  return PILLARS.map((p) => ({
    ...p,
    categories: rows
      .filter((c) => c.pillar === p.id)
      .map((c): LibCategory => {
        const drills = c.library_drills ?? [];
        const levels = [...new Set(drills.map((d) => d.level))].sort((a, b) => a - b);
        return {
          id: c.id,
          name: c.name,
          levels: levels.map((level) => ({
            level,
            drills: drills
              .filter((d) => d.level === level)
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((d): LibDrill => ({ id: d.id, name: d.name, blocks: toBlocks(d.library_drill_blocks) })),
          })),
        };
      }),
  }));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A drill's page: a library drill (by its uuid), or a skill's how-to page
 * (by the skill's id, e.g. "sk-recall").
 */
export async function getDrill(id: string): Promise<{ drill: LibDrill; category: string; level: number } | null> {
  if (UUID.test(id)) {
    const { data, error } = await supabase
      .from("library_drills")
      .select("id, name, level, library_categories(name), library_drill_blocks(id, type, text, url, sort_order)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const cat = data.library_categories as unknown as { name: string } | { name: string }[] | null;
    return {
      drill: { id: data.id as string, name: data.name as string, blocks: toBlocks(data.library_drill_blocks as unknown as BlockRow[]) },
      category: (Array.isArray(cat) ? cat[0]?.name : cat?.name) ?? "Drill",
      level: data.level as number,
    };
  }
  const [skill, blocks] = await Promise.all([
    supabase.from("skills").select("id, name, pillar, level").eq("id", id).maybeSingle(),
    supabase.from("skill_drill_blocks").select("id, type, text, url, sort_order").eq("skill_id", id),
  ]);
  if (skill.error) throw skill.error;
  const row = skill.data;
  if (!row) return null;
  const pillar = PILLARS.find((p) => p.id === row.pillar)?.name ?? "Skill";
  return {
    drill: { id, name: row.name as string, blocks: toBlocks((blocks.data ?? []) as BlockRow[]) },
    category: pillar,
    level: row.level as number,
  };
}
