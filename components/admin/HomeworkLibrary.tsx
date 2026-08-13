"use client";

import { useEffect, useRef, useState } from "react";
import {
  PlusIcon,
  CloseIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  CameraIcon,
  VideoIcon,
} from "@/components/ui/Icons";
import {
  HOMEWORK_LIBRARY,
  type LibCategory,
  type LibPillar,
  type DrillBlock,
} from "@/config/homeworkLibrary";
import {
  useLibrary,
  categoryDrills,
  moveDrill,
  addLibraryDrill,
  removeLibraryDrill,
  addBlock,
  updateBlockText,
  moveBlock,
  removeBlock,
  MAX_LEVEL,
  type LibDrillState,
} from "@/lib/homework-library/store";

/**
 * The drill library: pillar cards → category cards → the drills as one ordered
 * list with a "Level N" title before each level. A drill is a card the trainer
 * moves up/down (crossing a title moves a level); opening a card shows its
 * blog-style page — headings, paragraphs, photos and videos — which the trainer
 * builds up. Changes show here and (by name) on the owner's practice screen.
 */
export function HomeworkLibrary() {
  const overlay = useLibrary();
  const [pillarId, setPillarId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const pillar = HOMEWORK_LIBRARY.find((p) => p.id === pillarId) ?? null;
  const category = pillar?.categories.find((c) => c.id === categoryId) ?? null;

  const count = (p: LibPillar, c: LibCategory) => categoryDrills(overlay, p.id, c.id).length;

  // --- View 3: a category's drills — one list with level titles ------------
  if (pillar && category) {
    const drills = categoryDrills(overlay, pillar.id, category.id);
    const maxLevel = Math.max(2, ...drills.map((d) => d.level));
    const levels = Array.from({ length: maxLevel }, (_, i) => i + 1);
    const firstId = drills[0]?.id;
    const lastId = drills[drills.length - 1]?.id;
    const editing = drills.find((d) => d.id === editingId) ?? null;

    return (
      <div className="mt-8">
        <BackButton label={pillar.name} onClick={() => setCategoryId(null)} />
        <h2 className="mt-3 display-heading text-2xl text-paper">{category.name}</h2>
        <p className="mt-1 text-sm text-paper-dim">
          {pillar.name} · {drills.length} drills · move a card up or down to
          reorder it or cross into another level · open one to build its page
        </p>

        <div className="mt-5 space-y-2">
          {levels.map((level) => {
            const levelDrills = drills.filter((d) => d.level === level);
            return (
              <div key={level}>
                <div className="flex items-center justify-between pb-1.5 pt-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                    Level {level}
                  </h3>
                  <span className="text-xs text-paper-dim">
                    {levelDrills.length} drill{levelDrills.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="space-y-2">
                  {levelDrills.map((drill) => (
                    <DrillCard
                      key={drill.id}
                      drill={drill}
                      pillarId={pillar.id}
                      categoryId={category.id}
                      isFirst={drill.id === firstId}
                      isLast={drill.id === lastId}
                      onOpen={() => setEditingId(drill.id)}
                    />
                  ))}
                </div>

                <AddDrill pillarId={pillar.id} categoryId={category.id} level={level} />
              </div>
            );
          })}
        </div>

        {editing && (
          <DrillEditor
            pillarId={pillar.id}
            categoryId={category.id}
            drill={editing}
            onClose={() => setEditingId(null)}
          />
        )}
      </div>
    );
  }

  // --- View 2: a pillar's categories ---------------------------------------
  if (pillar) {
    return (
      <div className="mt-8">
        <BackButton label="All pillars" onClick={() => setPillarId(null)} />
        <h2 className="mt-3 display-heading text-2xl text-paper">{pillar.name}</h2>
        <p className="mt-1 text-sm text-paper-dim">{pillar.blurb}</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {pillar.categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] p-4 text-left ring-1 ring-white/10 transition-colors hover:ring-white/25"
            >
              <span className="min-w-0">
                <span className="block font-semibold text-paper">{c.name}</span>
                <span className="block text-xs text-paper-dim">{count(pillar, c)} drills</span>
              </span>
              <ArrowRightIcon width={16} height={16} className="shrink-0 text-paper-dim" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // --- View 1: the three pillars -------------------------------------------
  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-3">
      {HOMEWORK_LIBRARY.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => setPillarId(p.id)}
          className="flex flex-col rounded-2xl bg-white/[0.04] p-5 text-left ring-1 ring-white/10 transition-colors hover:ring-white/25"
        >
          <span className="text-lg font-semibold text-paper">{p.name}</span>
          <span className="mt-0.5 text-xs text-paper-dim">{p.blurb}</span>
          <span className="mt-4 flex items-center justify-between text-xs font-medium text-accent">
            {p.categories.length} categories
            <ArrowRightIcon width={16} height={16} />
          </span>
        </button>
      ))}
    </div>
  );
}

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm text-paper-dim transition-colors hover:text-accent"
    >
      <ArrowRightIcon width={16} height={16} className="rotate-180" /> {label}
    </button>
  );
}

/** One drill card — move up/down through the list, open its page, remove. */
function DrillCard({
  drill,
  pillarId,
  categoryId,
  isFirst,
  isLast,
  onOpen,
}: {
  drill: LibDrillState;
  pillarId: string;
  categoryId: string;
  isFirst: boolean;
  isLast: boolean;
  onOpen: () => void;
}) {
  const media = drill.blocks.filter((b) => b.type === "image" || b.type === "video").length;
  const ctrl =
    "flex h-7 w-7 items-center justify-center rounded-lg text-paper-dim transition-colors hover:bg-white/10 hover:text-paper disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-paper-dim";
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white/[0.03] p-2.5 ring-1 ring-white/10">
      <div className="flex flex-col">
        <button
          type="button"
          aria-label="Move up"
          disabled={isFirst}
          onClick={() => moveDrill(pillarId, categoryId, drill.id, -1)}
          className={ctrl}
        >
          <ChevronDownIcon width={15} height={15} className="rotate-180" />
        </button>
        <button
          type="button"
          aria-label="Move down"
          disabled={isLast && drill.level >= MAX_LEVEL}
          onClick={() => moveDrill(pillarId, categoryId, drill.id, 1)}
          className={ctrl}
        >
          <ChevronDownIcon width={15} height={15} />
        </button>
      </div>

      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-paper">{drill.name}</span>
        {media > 0 && (
          <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-paper-dim">
            {media} media
          </span>
        )}
        <ArrowRightIcon width={15} height={15} className="shrink-0 text-paper-dim" />
      </button>

      <button
        type="button"
        aria-label="Remove drill"
        onClick={() => removeLibraryDrill(pillarId, categoryId, drill.id)}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-paper-dim transition-colors hover:bg-white/10 hover:text-paper"
      >
        <CloseIcon width={15} height={15} />
      </button>
    </div>
  );
}

function AddDrill({
  pillarId,
  categoryId,
  level,
}: {
  pillarId: string;
  categoryId: string;
  level: number;
}) {
  const [name, setName] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    addLibraryDrill(pillarId, categoryId, level, name);
    setName("");
  }
  return (
    <form onSubmit={submit} className="mt-2 flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={`Add a Level ${level} drill…`}
        className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2 text-sm text-paper placeholder:text-paper-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <button
        type="submit"
        disabled={!name.trim()}
        className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-accent px-3 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        <PlusIcon width={14} height={14} /> Add
      </button>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Drill page editor — blog-style blocks                                      */
/* -------------------------------------------------------------------------- */

function DrillEditor({
  pillarId,
  categoryId,
  drill,
  onClose,
}: {
  pillarId: string;
  categoryId: string;
  drill: LibDrillState;
  onClose: () => void;
}) {
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  function addText(type: "heading" | "paragraph") {
    addBlock(pillarId, categoryId, drill.id, { id: crypto.randomUUID(), type, text: "" });
  }

  function onPickMedia(type: "image" | "video", files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      addBlock(pillarId, categoryId, drill.id, {
        id: crypto.randomUUID(),
        type,
        url: String(reader.result),
      });
    reader.readAsDataURL(file);
  }

  const tool =
    "inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:border-white/40";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${drill.name} page`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl bg-ink-soft ring-1 ring-white/15 sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">Drill page</p>
            <h2 className="display-heading truncate text-xl text-paper">{drill.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-paper/70 hover:bg-white/10 hover:text-paper"
          >
            <CloseIcon width={20} height={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5">
          {drill.blocks.length === 0 && (
            <p className="rounded-2xl bg-white/[0.04] p-4 text-sm text-paper-dim ring-1 ring-white/10">
              Empty page — add a title, paragraph, photo or video below.
            </p>
          )}
          {drill.blocks.map((block, i) => (
            <BlockEditor
              key={block.id}
              block={block}
              isFirst={i === 0}
              isLast={i === drill.blocks.length - 1}
              onMove={(dir) => moveBlock(pillarId, categoryId, drill.id, block.id, dir)}
              onRemove={() => removeBlock(pillarId, categoryId, drill.id, block.id)}
              onText={(text) => updateBlockText(pillarId, categoryId, drill.id, block.id, text)}
            />
          ))}
        </div>

        <footer className="flex flex-wrap gap-2 border-t border-white/10 px-5 py-4">
          <button type="button" onClick={() => addText("heading")} className={tool}>
            <PlusIcon width={13} height={13} /> Title
          </button>
          <button type="button" onClick={() => addText("paragraph")} className={tool}>
            <PlusIcon width={13} height={13} /> Paragraph
          </button>
          <button type="button" onClick={() => photoRef.current?.click()} className={tool}>
            <CameraIcon width={14} height={14} /> Photo
          </button>
          <button type="button" onClick={() => videoRef.current?.click()} className={tool}>
            <VideoIcon width={14} height={14} /> Video
          </button>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPickMedia("image", e.target.files)}
          />
          <input
            ref={videoRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => onPickMedia("video", e.target.files)}
          />
        </footer>
      </div>
    </div>
  );
}

/** One content block with move/remove controls; text blocks are editable. */
function BlockEditor({
  block,
  isFirst,
  isLast,
  onMove,
  onRemove,
  onText,
}: {
  block: DrillBlock;
  isFirst: boolean;
  isLast: boolean;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onText: (text: string) => void;
}) {
  const ctrl =
    "flex h-6 w-6 items-center justify-center rounded-md text-paper-dim transition-colors hover:bg-white/10 hover:text-paper disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className="rounded-xl bg-white/[0.03] p-2.5 ring-1 ring-white/10">
      <div className="mb-1.5 flex items-center justify-end gap-0.5">
        <button type="button" aria-label="Move up" disabled={isFirst} onClick={() => onMove(-1)} className={ctrl}>
          <ChevronDownIcon width={13} height={13} className="rotate-180" />
        </button>
        <button type="button" aria-label="Move down" disabled={isLast} onClick={() => onMove(1)} className={ctrl}>
          <ChevronDownIcon width={13} height={13} />
        </button>
        <button type="button" aria-label="Remove block" onClick={onRemove} className={ctrl}>
          <CloseIcon width={13} height={13} />
        </button>
      </div>

      {block.type === "heading" && (
        <TextBlock
          value={block.text}
          onSave={onText}
          placeholder="Section title"
          className="w-full bg-transparent text-lg font-semibold text-paper outline-none placeholder:text-paper-dim"
        />
      )}
      {block.type === "paragraph" && (
        <TextBlock
          value={block.text}
          onSave={onText}
          multiline
          placeholder="Write the how-to…"
          className="w-full resize-y bg-transparent text-sm leading-relaxed text-paper/90 outline-none placeholder:text-paper-dim"
        />
      )}
      {block.type === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={block.url} alt="" className="w-full rounded-lg" />
      )}
      {block.type === "video" && (
        <video src={block.url} controls className="w-full rounded-lg bg-black" />
      )}
    </div>
  );
}

/** Editable text — keeps a local draft, saves on blur. */
function TextBlock({
  value,
  onSave,
  multiline,
  placeholder,
  className,
}: {
  value: string;
  onSave: (text: string) => void;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const commit = () => {
    if (text !== value) onSave(text);
  };
  return multiline ? (
    <textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      rows={3}
      placeholder={placeholder}
      className={className}
    />
  ) : (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      placeholder={placeholder}
      className={className}
    />
  );
}
