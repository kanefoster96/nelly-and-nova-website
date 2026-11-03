"use client";

/**
 * The homework drill library — live from Supabase.
 * ------------------------------------------------
 *   library_categories    pillar → category (slug, name, order)
 *   library_drills        a category's drills, each at a level, in order
 *   library_drill_blocks  a drill's blog-style page (headings, paragraphs,
 *                         photos, videos), in order
 *
 * Everyone signed in can read it (owners open a drill from their homework);
 * only trainers write (Row Level Security). Photos and videos go to the
 * public `drill-media` bucket. Edits show straight away and save in the
 * background; typing in a block is saved after a short pause.
 */
import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { HOMEWORK_LIBRARY, type DrillBlock } from "@/config/homeworkLibrary";

export type LibDrillState = { id: string; name: string; level: number; blocks: DrillBlock[] };
export type LibCategoryState = { id: string; dbId: string; name: string };
export type LibPillarState = { id: string; name: string; blurb: string; categories: LibCategoryState[] };
export type LibraryOverlay = {
  loaded: boolean;
  error: string | null;
  pillars: LibPillarState[];
  /** catKey(pillar, category slug) → that category's drills, in order. */
  categories: Record<string, LibDrillState[]>;
};

/** Highest level a drill can be promoted to (a safety cap on new levels). */
export const MAX_LEVEL = 5;
export const DRILL_MEDIA_BUCKET = "drill-media";

/** The three pillars' names and blurbs (the categories and drills are in the database). */
const PILLAR_META = HOMEWORK_LIBRARY.map((p) => ({ id: p.id, name: p.name, blurb: p.blurb }));

const EMPTY: LibraryOverlay = {
  loaded: false,
  error: null,
  pillars: PILLAR_META.map((p) => ({ ...p, categories: [] })),
  categories: {},
};
let state: LibraryOverlay = EMPTY;
const listeners = new Set<() => void>();
let started = false;

function sb() {
  return createClient();
}

function emit(next: LibraryOverlay) {
  state = next;
  for (const l of listeners) l();
}

export function catKey(pillarId: string, categoryId: string): string {
  return `${pillarId}:${categoryId}`;
}

type BlockRow = { id: string; type: DrillBlock["type"]; text: string | null; url: string | null; sort_order: number };
type DrillRow = { id: string; name: string; level: number; sort_order: number; library_drill_blocks: BlockRow[] | null };
type CategoryRow = { id: string; pillar: string; slug: string; name: string; sort_order: number; library_drills: DrillRow[] | null };

export function toBlock(b: BlockRow): DrillBlock {
  return b.type === "image" || b.type === "video"
    ? { id: b.id, type: b.type, url: b.url ?? "" }
    : { id: b.id, type: b.type, text: b.text ?? "" };
}

async function fetchLibrary(): Promise<LibraryOverlay> {
  const { data, error } = await sb()
    .from("library_categories")
    .select("id, pillar, slug, name, sort_order, library_drills(id, name, level, sort_order, library_drill_blocks(id, type, text, url, sort_order))")
    .order("sort_order");
  if (error) throw new Error(`Couldn't load the drill library. ${error.message}`);
  const rows = (data ?? []) as unknown as CategoryRow[];
  const categories: Record<string, LibDrillState[]> = {};
  const pillars = PILLAR_META.map((p) => ({
    ...p,
    categories: rows
      .filter((c) => c.pillar === p.id)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .map((c) => {
        categories[catKey(p.id, c.slug)] = [...(c.library_drills ?? [])]
          .sort((a, b) => a.level - b.level || a.sort_order - b.sort_order)
          .map((d) => ({
            id: d.id,
            name: d.name,
            level: d.level,
            blocks: [...(d.library_drill_blocks ?? [])].sort((a, b) => a.sort_order - b.sort_order).map(toBlock),
          }));
        return { id: c.slug, dbId: c.id, name: c.name };
      }),
  }));
  return { loaded: true, error: null, pillars, categories };
}

export async function refreshLibrary(): Promise<void> {
  try {
    emit(await fetchLibrary());
  } catch (err) {
    emit({ ...state, loaded: true, error: err instanceof Error ? err.message : "Couldn't load the drill library." });
  }
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  void refreshLibrary();
  sb().auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") void refreshLibrary();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  start();
  return () => {
    listeners.delete(cb);
  };
}

export function useLibrary(): LibraryOverlay {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}

// --- reads -------------------------------------------------------------------

/** A category's drills, in order (level, then position). */
export function categoryDrills(overlay: LibraryOverlay, pillarId: string, categoryId: string): LibDrillState[] {
  return overlay.categories[catKey(pillarId, categoryId)] ?? [];
}

type Found = { drill: LibDrillState; pillarId: string; category: LibCategoryState };

function* everyDrill(overlay: LibraryOverlay): Generator<Found> {
  for (const pillar of overlay.pillars)
    for (const category of pillar.categories)
      for (const drill of categoryDrills(overlay, pillar.id, category.id)) yield { drill, pillarId: pillar.id, category };
}

/** A library drill by its id (a report card item's drill_ref). */
export function findLibraryDrill(overlay: LibraryOverlay, id: string | null | undefined): Found | undefined {
  if (!id) return undefined;
  for (const f of everyDrill(overlay)) if (f.drill.id === id) return f;
  return undefined;
}

/** Find a library drill (with its blocks) by name — for homework typed in by hand. */
export function findLibraryDrillByName(overlay: LibraryOverlay, name: string): LibDrillState | undefined {
  const key = name.trim().toLowerCase();
  for (const f of everyDrill(overlay)) if (f.drill.name.toLowerCase() === key) return f.drill;
  return undefined;
}

/** Index of drill name → { pillar, level } across the whole library. */
export function libraryNameIndex(overlay: LibraryOverlay): Map<string, { pillar: string; level: number }> {
  const map = new Map<string, { pillar: string; level: number }>();
  for (const f of everyDrill(overlay)) map.set(f.drill.name.toLowerCase(), { pillar: f.pillarId, level: f.drill.level });
  return map;
}

/** Every category, for the report card's category picker. */
export function libraryCategories(overlay: LibraryOverlay): (LibCategoryState & { pillarId: string })[] {
  return overlay.pillars.flatMap((p) => p.categories.map((c) => ({ ...c, pillarId: p.id })));
}

/** The drills in a category by its name (case-insensitive), with their pillar. */
export function drillsForCategoryName(overlay: LibraryOverlay, name: string): (LibDrillState & { pillarId: string })[] {
  const key = name.trim().toLowerCase();
  const cat = libraryCategories(overlay).find((c) => c.name.toLowerCase() === key);
  return cat ? categoryDrills(overlay, cat.pillarId, cat.id).map((d) => ({ ...d, pillarId: cat.pillarId })) : [];
}

// --- writes (trainers) -------------------------------------------------------

function fail(what: string, error: { message?: string } | null): never {
  const msg = error?.message ?? "";
  if (/row-level security|permission denied/i.test(msg)) throw new Error(`${what}: trainers only.`);
  throw new Error(`${what}. ${msg || "Please try again."}`.trim());
}

function report(err: unknown) {
  console.error("[library]", err);
  emit({ ...state, error: err instanceof Error ? err.message : "Couldn't save that change." });
  void refreshLibrary();
}

function setCategory(pillarId: string, categoryId: string, drills: LibDrillState[]) {
  emit({ ...state, error: null, categories: { ...state.categories, [catKey(pillarId, categoryId)]: drills } });
}

function setBlocks(pillarId: string, categoryId: string, drillId: string, fn: (blocks: DrillBlock[]) => DrillBlock[]) {
  const drills = categoryDrills(state, pillarId, categoryId).map((d) => (d.id === drillId ? { ...d, blocks: fn([...d.blocks]) } : d));
  setCategory(pillarId, categoryId, drills);
  return drills.find((d) => d.id === drillId)?.blocks ?? [];
}

/** Save each drill's level and position where it changed. */
async function saveOrder(before: LibDrillState[], after: LibDrillState[]) {
  const pos = (list: LibDrillState[]) => {
    const out = new Map<string, { level: number; sort: number }>();
    const counts: Record<number, number> = {};
    for (const d of list) {
      counts[d.level] = (counts[d.level] ?? -1) + 1;
      out.set(d.id, { level: d.level, sort: counts[d.level] });
    }
    return out;
  };
  const was = pos(before);
  const now = pos(after);
  for (const [id, p] of now) {
    const old = was.get(id);
    if (old && old.level === p.level && old.sort === p.sort) continue;
    const { error } = await sb().from("library_drills").update({ level: p.level, sort_order: p.sort, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) fail("Couldn't move the drill", error);
  }
}

/**
 * Move a drill up (-1) or down (+1) through the one ordered list. Within its
 * level it swaps with the neighbour; at a level boundary it crosses into the
 * next level (down promotes, up demotes) — so a card walks up and down the
 * whole list and the level headings sort themselves out. The last drill moving
 * down opens a new level (up to MAX_LEVEL).
 */
export function moveDrill(pillarId: string, categoryId: string, drillId: string, dir: -1 | 1) {
  const before = categoryDrills(state, pillarId, categoryId);
  const drills = before.map((d) => ({ ...d }));
  const i = drills.findIndex((d) => d.id === drillId);
  if (i < 0) return;
  const level = drills[i].level;
  const j = i + dir;
  if (j < 0) return;
  if (j >= drills.length) {
    if (dir === 1 && level < MAX_LEVEL) drills[i].level = level + 1;
    else return;
  } else if (drills[j].level === level) {
    [drills[i], drills[j]] = [drills[j], drills[i]];
  } else {
    drills[i].level = drills[j].level;
  }
  setCategory(pillarId, categoryId, drills);
  saveOrder(before, drills).catch(report);
}

export function addLibraryDrill(pillarId: string, categoryId: string, level: number, name: string, description = "") {
  const text = name.trim();
  const cat = state.pillars.find((p) => p.id === pillarId)?.categories.find((c) => c.id === categoryId);
  if (!text || !cat) return;
  const drills = categoryDrills(state, pillarId, categoryId);
  const id = crypto.randomUUID();
  const blocks: DrillBlock[] = description.trim() ? [{ id: crypto.randomUUID(), type: "paragraph", text: description.trim() }] : [];
  let at = 0;
  drills.forEach((d, idx) => {
    if (d.level <= level) at = idx + 1;
  });
  const next = [...drills];
  next.splice(at, 0, { id, name: text, level, blocks });
  setCategory(pillarId, categoryId, next);
  (async () => {
    const sort = next.filter((d) => d.level === level).findIndex((d) => d.id === id);
    const { error } = await sb().from("library_drills").insert({ id, category_id: cat.dbId, name: text, level, sort_order: sort });
    if (error) fail("Couldn't add the drill", error);
    if (blocks[0]) {
      const b = blocks[0];
      const { error: e2 } = await sb().from("library_drill_blocks").insert({ id: b.id, drill_id: id, type: "paragraph", text: description.trim(), sort_order: 0 });
      if (e2) fail("Couldn't add the drill", e2);
    }
    await saveOrder(drills, next);
  })().catch(report);
}

export function removeLibraryDrill(pillarId: string, categoryId: string, drillId: string) {
  setCategory(pillarId, categoryId, categoryDrills(state, pillarId, categoryId).filter((d) => d.id !== drillId));
  (async () => {
    const { error } = await sb().from("library_drills").delete().eq("id", drillId);
    if (error) fail("Couldn't remove the drill", error);
  })().catch(report);
}

// --- a drill's page ------------------------------------------------------------

/** Turn a picked file (data: URL) into a public URL in the drill-media bucket. */
export async function uploadDrillMedia(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith("data:")) return dataUrl;
  const blob = await (await fetch(dataUrl)).blob();
  const ext = (blob.type.split("/")[1] || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "bin";
  const path = `drills/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb().storage.from(DRILL_MEDIA_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) fail("Couldn't upload that file", error);
  return sb().storage.from(DRILL_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Shared by drill pages and skill pages: save blocks' positions. */
export async function saveBlockOrder(table: "library_drill_blocks" | "skill_drill_blocks", blocks: DrillBlock[]) {
  for (let i = 0; i < blocks.length; i++) {
    const { error } = await sb().from(table).update({ sort_order: i }).eq("id", blocks[i].id);
    if (error) fail("Couldn't reorder the page", error);
  }
}

/** Saves typing after a short pause, per block. */
const pending = new Map<string, ReturnType<typeof setTimeout>>();
export function saveBlockTextSoon(table: "library_drill_blocks" | "skill_drill_blocks", blockId: string, text: string, onError: (err: unknown) => void) {
  const t = pending.get(blockId);
  if (t) clearTimeout(t);
  pending.set(
    blockId,
    setTimeout(async () => {
      pending.delete(blockId);
      const { error } = await sb().from(table).update({ text }).eq("id", blockId);
      if (error) onError(new Error(`Couldn't save that text. ${error.message}`));
    }, 600)
  );
}

/** Append a content block to a drill. Pass a fresh id (crypto.randomUUID). */
export function addBlock(pillarId: string, categoryId: string, drillId: string, block: DrillBlock) {
  const blocks = setBlocks(pillarId, categoryId, drillId, (b) => [...b, block]);
  (async () => {
    let url: string | null = null;
    if (block.type === "image" || block.type === "video") {
      url = await uploadDrillMedia(block.url);
      setBlocks(pillarId, categoryId, drillId, (b) => b.map((x) => (x.id === block.id ? { ...block, url: url! } : x)));
    }
    const { error } = await sb().from("library_drill_blocks").insert({
      id: block.id,
      drill_id: drillId,
      type: block.type,
      text: block.type === "heading" || block.type === "paragraph" ? block.text : null,
      url,
      sort_order: blocks.length - 1,
    });
    if (error) fail("Couldn't add that to the page", error);
  })().catch(report);
}

/** Edit a heading/paragraph block's text. */
export function updateBlockText(pillarId: string, categoryId: string, drillId: string, blockId: string, text: string) {
  setBlocks(pillarId, categoryId, drillId, (blocks) =>
    blocks.map((b) => (b.id === blockId && (b.type === "heading" || b.type === "paragraph") ? { ...b, text } : b))
  );
  saveBlockTextSoon("library_drill_blocks", blockId, text, report);
}

export function moveBlock(pillarId: string, categoryId: string, drillId: string, blockId: string, dir: -1 | 1) {
  const blocks = setBlocks(pillarId, categoryId, drillId, (blocks) => {
    const i = blocks.findIndex((b) => b.id === blockId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return blocks;
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    return blocks;
  });
  saveBlockOrder("library_drill_blocks", blocks).catch(report);
}

export function removeBlock(pillarId: string, categoryId: string, drillId: string, blockId: string) {
  setBlocks(pillarId, categoryId, drillId, (blocks) => blocks.filter((b) => b.id !== blockId));
  (async () => {
    const { error } = await sb().from("library_drill_blocks").delete().eq("id", blockId);
    if (error) fail("Couldn't remove that from the page", error);
  })().catch(report);
}
