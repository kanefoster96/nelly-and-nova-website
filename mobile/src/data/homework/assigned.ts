import { config } from "@/lib/config";
import { supabase } from "@/lib/supabase";

import { getReportCards, HOMEWORK_TARGET_DAYS, todayUK, type ReportCard } from "../reports";
import { pushNotices } from "../register";
import type { DrillBlock } from "./library";

/**
 * The owner's homework: each published report card's homework, done on 3
 * different days (UK dates, once a day) to complete it. Nothing expires:
 * it stays to do until it reaches 3 of 3. Each day can carry a note and a
 * short video for the trainer (homework_days); videos are deleted once the
 * homework is complete, keeping the notes and dates. The rules live in the
 * database: nn_homework_complete_day, supabase/migrations/20261104080000_owner_onboarding.sql.
 */

export const VIDEO_BUCKET = "homework-videos";
export const MAX_VIDEO_SECONDS = 30;

export type HomeworkDay = {
  date: string; // YYYY-MM-DD
  note: string | null;
  videoPath: string | null;
  videoRemoved: boolean;
};

export type Homework = {
  card: ReportCard;
  days: HomeworkDay[]; // oldest first
  complete: boolean;
  doneToday: boolean;
  /** How to do it: the drills' library instructions, then the trainer's notes. */
  instructions: string;
  /** Every drill's library page, by the drill's ref. */
  blocks: Record<string, DrillBlock[]>;
  /** Everything search looks through, lower-cased. */
  haystack: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type BlockRow = { id: string; type: DrillBlock["type"]; text: string | null; url: string | null; sort_order: number };
const toBlock = (b: BlockRow): DrillBlock => (b.type === "image" || b.type === "video" ? { id: b.id, type: b.type, url: b.url ?? "" } : { id: b.id, type: b.type, text: b.text ?? "" });

/** The library pages (instructions, photos, videos) of the drills set. */
async function drillBlocks(refs: string[]): Promise<Record<string, DrillBlock[]>> {
  const lib = refs.filter((r) => UUID.test(r));
  const skills = refs.filter((r) => !UUID.test(r));
  const [a, b] = await Promise.all([
    lib.length ? supabase.from("library_drill_blocks").select("id, drill_id, type, text, url, sort_order").in("drill_id", lib) : Promise.resolve({ data: [] }),
    skills.length ? supabase.from("skill_drill_blocks").select("id, skill_id, type, text, url, sort_order").in("skill_id", skills) : Promise.resolve({ data: [] }),
  ]);
  const out: Record<string, DrillBlock[]> = {};
  const rows = [
    ...((a.data ?? []) as (BlockRow & { drill_id: string })[]).map((r) => ({ ...r, ref: r.drill_id })),
    ...((b.data ?? []) as (BlockRow & { skill_id: string })[]).map((r) => ({ ...r, ref: r.skill_id })),
  ].sort((x, y) => x.sort_order - y.sort_order);
  for (const r of rows) (out[r.ref] ??= []).push(toBlock(r));
  return out;
}

/** Every homework the owner's dogs have been set, newest first. */
export async function getHomework(): Promise<Homework[]> {
  const [bundle, daysRes] = await Promise.all([
    getReportCards(),
    supabase.from("homework_days").select("report_card_id, practised_on, note, video_path, video_removed_at").order("practised_on").limit(5000),
  ]);
  const byCard: Record<string, Map<string, HomeworkDay>> = {};
  for (const r of (daysRes.data ?? []) as { report_card_id: string; practised_on: string; note: string | null; video_path: string | null; video_removed_at: string | null }[]) {
    (byCard[r.report_card_id] ??= new Map()).set(r.practised_on, { date: r.practised_on, note: r.note, videoPath: r.video_path, videoRemoved: !!r.video_removed_at });
  }
  // Days from before homework_days (or an older app) still count.
  for (const [cardId, dates] of Object.entries(bundle.progress)) {
    const m = (byCard[cardId] ??= new Map());
    for (const d of dates) if (!m.has(d)) m.set(d, { date: d, note: null, videoPath: null, videoRemoved: false });
  }

  const cards = bundle.cards.filter((c) => c.homework.some((cat) => cat.drills.length > 0));
  const refs = [...new Set(cards.flatMap((c) => c.homework.flatMap((cat) => cat.drills.map((d) => d.ref).filter((r): r is string => !!r))))];
  const blocks = await drillBlocks(refs).catch(() => ({}) as Record<string, DrillBlock[]>);
  const today = todayUK();

  return cards.map((card) => {
    const days = [...(byCard[card.id]?.values() ?? [])].sort((a, b) => a.date.localeCompare(b.date));
    const drills = card.homework.flatMap((cat) => cat.drills);
    const cardBlocks: Record<string, DrillBlock[]> = {};
    for (const d of drills) if (d.ref && blocks[d.ref]) cardBlocks[d.ref] = blocks[d.ref];
    const libraryText = drills
      .flatMap((d) => (d.ref ? (cardBlocks[d.ref] ?? []) : []))
      .map((b) => ("text" in b ? b.text : ""))
      .filter(Boolean);
    const notes = drills.map((d) => d.note).filter((n): n is string => !!n);
    const instructions = [...libraryText, ...notes].join("\n\n").trim() || card.summary;
    const haystack = [
      card.focus,
      card.summary,
      ...card.wins,
      ...card.homework.map((c) => c.name),
      ...drills.flatMap((d) => [d.name, d.pillar ?? "", d.note ?? ""]),
      ...libraryText,
      ...days.map((d) => d.note ?? ""),
    ]
      .join(" \n ")
      .toLowerCase();
    return {
      card,
      days,
      complete: days.length >= HOMEWORK_TARGET_DAYS,
      doneToday: days.some((d) => d.date === today),
      instructions,
      blocks: cardBlocks,
      haystack,
    };
  });
}

/** How many of a dog's homework are still to do (the Profile tab's summary). */
export function toDoCount(list: Homework[], dogId: string): number {
  return list.filter((h) => h.card.dogId === dogId && !h.complete).length;
}

export type PickedVideo = { uri: string; name: string; mimeType: string; durationMs: number | null; size: number | null };

/** Upload a homework video into the owner's own folder of the private bucket. */
async function uploadVideo(cardId: string, video: PickedVideo): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Please sign in again.");
  const ext = (video.name.split(".").pop() || (video.mimeType.includes("quicktime") ? "mov" : "mp4")).toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
  const path = `${data.user.id}/${cardId}/${Date.now()}.${ext}`;
  const bytes = await (await fetch(video.uri)).arrayBuffer();
  if (bytes.byteLength > 50 * 1024 * 1024) throw new Error("That video is too big to send. Please record a shorter one.");
  const { error } = await supabase.storage.from(VIDEO_BUCKET).upload(path, bytes, { contentType: video.mimeType || "video/mp4" });
  if (error) throw new Error("Couldn't upload the video. Please try again.");
  return path;
}

export type CompleteResult = { day: number; complete: boolean; date: string };

/**
 * "Complete today": records today (once a day), with the optional note and
 * video. With either, it's also posted in their chat ("Homework: Sit, day
 * 2 of 3") and the trainers are told. The 3rd day completes it and its
 * videos are deleted.
 */
export async function completeToday(h: Homework, extras: { note?: string; video?: PickedVideo | null; onStage?: (stage: "uploading" | "saving") => void }): Promise<CompleteResult> {
  let videoPath: string | null = null;
  if (extras.video) {
    extras.onStage?.("uploading");
    videoPath = await uploadVideo(h.card.id, extras.video);
  }
  extras.onStage?.("saving");
  const { data, error } = await supabase.rpc("nn_homework_complete_day", {
    p_card_id: h.card.id,
    p_title: h.card.focus,
    p_note: extras.note?.trim() || null,
    p_video_path: videoPath,
    p_video_name: extras.video?.name ?? null,
  });
  if (error) {
    if (videoPath) void supabase.storage.from(VIDEO_BUCKET).remove([videoPath]);
    throw new Error(error.message || "Couldn't save today. Please try again.");
  }
  const r = data as { day: number; complete: boolean; date: string; notices?: unknown };
  void pushNotices(r.notices);
  if (r.complete) void cleanupVideos(h.card.id);
  return { day: r.day, complete: r.complete, date: r.date };
}

/** Once complete: ask the website to delete this homework's videos (it checks it really is complete). */
export async function cleanupVideos(cardId: string): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch(new URL("/api/homework/cleanup", config.siteUrl).toString(), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ cardId }),
    });
  } catch {
    // The website's daily sweep catches anything left.
  }
}

/** A short-lived link to play one of their homework videos. */
export async function videoLink(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(VIDEO_BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

/** "November 2026" for grouping. */
export function monthLabel(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "Europe/London" });
}

export function shortDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
}
