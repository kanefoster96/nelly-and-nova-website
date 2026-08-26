/**
 * Homework drill library editor — real `library_categories`/`library_drills`/
 * `library_drill_blocks` tables (already seeded with 9 real categories, no
 * mobile-app image picker anymore, so blocks here are text-only for now:
 * heading/paragraph. Existing photo/video blocks, if any get added another
 * way later, still render — just aren't creatable from this screen).
 */
import { supabase } from "@/lib/supabase";

export type Pillar = "engagement" | "skills" | "mindset";

export type LibraryCategory = { id: string; pillar: Pillar; name: string; sortOrder: number };
export type LibraryDrill = { id: string; categoryId: string; name: string; level: number; sortOrder: number };
export type DrillBlock = {
  id: string;
  type: "heading" | "paragraph" | "image" | "video";
  text: string | null;
  url: string | null;
  sortOrder: number;
};

export async function getCategories(): Promise<LibraryCategory[]> {
  const { data } = await supabase
    .from("library_categories")
    .select("id, pillar, name, sort_order")
    .order("pillar")
    .order("sort_order");
  return (data ?? []).map((c) => ({ id: c.id, pillar: c.pillar as Pillar, name: c.name, sortOrder: c.sort_order }));
}

export async function createCategory(pillar: Pillar, name: string): Promise<{ error: string | null }> {
  const { count } = await supabase
    .from("library_categories")
    .select("id", { count: "exact", head: true })
    .eq("pillar", pillar);
  const { error } = await supabase
    .from("library_categories")
    .insert({ pillar, name: name.trim(), slug: name.trim().toLowerCase().replace(/\s+/g, "-"), sort_order: count ?? 0 });
  return { error: error?.message ?? null };
}

export async function getDrills(categoryId: string): Promise<LibraryDrill[]> {
  const { data } = await supabase
    .from("library_drills")
    .select("id, category_id, name, level, sort_order")
    .eq("category_id", categoryId)
    .order("level")
    .order("sort_order");
  return (data ?? []).map((d) => ({ id: d.id, categoryId: d.category_id, name: d.name, level: d.level, sortOrder: d.sort_order }));
}

export async function createDrill(categoryId: string, name: string, level: number): Promise<{ error: string | null }> {
  const { count } = await supabase
    .from("library_drills")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId)
    .eq("level", level);
  const { error } = await supabase
    .from("library_drills")
    .insert({ category_id: categoryId, name: name.trim(), level, sort_order: count ?? 0 });
  return { error: error?.message ?? null };
}

export async function deleteDrill(drillId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("library_drills").delete().eq("id", drillId);
  return { error: error?.message ?? null };
}

export async function getDrillBlocks(drillId: string): Promise<DrillBlock[]> {
  const { data } = await supabase
    .from("library_drill_blocks")
    .select("id, type, text, url, sort_order")
    .eq("drill_id", drillId)
    .order("sort_order");
  return (data ?? []).map((b) => ({ id: b.id, type: b.type, text: b.text, url: b.url, sortOrder: b.sort_order }));
}

export async function addTextBlock(
  drillId: string,
  type: "heading" | "paragraph",
  text: string
): Promise<{ error: string | null }> {
  const { count } = await supabase
    .from("library_drill_blocks")
    .select("id", { count: "exact", head: true })
    .eq("drill_id", drillId);
  const { error } = await supabase
    .from("library_drill_blocks")
    .insert({ drill_id: drillId, type, text: text.trim(), sort_order: count ?? 0 });
  return { error: error?.message ?? null };
}

export async function updateBlockText(blockId: string, text: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("library_drill_blocks").update({ text: text.trim() }).eq("id", blockId);
  return { error: error?.message ?? null };
}

export async function deleteBlock(blockId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("library_drill_blocks").delete().eq("id", blockId);
  return { error: error?.message ?? null };
}

/** Swap sort_order with the neighbouring block (arrows, not drag-and-drop — same reliability trade-off as elsewhere in this app). */
export async function moveBlock(blocks: DrillBlock[], blockId: string, direction: "up" | "down"): Promise<{ error: string | null }> {
  const index = blocks.findIndex((b) => b.id === blockId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= blocks.length) return { error: null };

  const a = blocks[index];
  const b = blocks[swapWith];
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from("library_drill_blocks").update({ sort_order: b.sortOrder }).eq("id", a.id),
    supabase.from("library_drill_blocks").update({ sort_order: a.sortOrder }).eq("id", b.id),
  ]);
  return { error: e1?.message ?? e2?.message ?? null };
}
