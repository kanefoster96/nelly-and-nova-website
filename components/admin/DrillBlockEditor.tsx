"use client";

import { useRef, useState } from "react";
import {
  PlusIcon,
  CloseIcon,
  ChevronDownIcon,
  CameraIcon,
  VideoIcon,
} from "@/components/ui/Icons";
import type { DrillBlock } from "@/config/homeworkLibrary";

/**
 * The blog-style drill page editor — an ordered list of content blocks
 * (headings, paragraphs, photos, videos) with a toolbar to add more. Kept
 * storage-agnostic via callbacks so it drives both the trainer's homework
 * library and the per-skill drill pages on the Status panel.
 */
export function DrillBlockEditor({
  blocks,
  onAdd,
  onText,
  onMove,
  onRemove,
}: {
  blocks: DrillBlock[];
  onAdd: (block: DrillBlock) => void;
  onText: (blockId: string, text: string) => void;
  onMove: (blockId: string, dir: -1 | 1) => void;
  onRemove: (blockId: string) => void;
}) {
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  function addText(type: "heading" | "paragraph") {
    onAdd({ id: crypto.randomUUID(), type, text: "" });
  }

  function onPickMedia(type: "image" | "video", files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onAdd({ id: crypto.randomUUID(), type, url: String(reader.result) });
    reader.readAsDataURL(file);
  }

  const tool =
    "inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:border-white/40";

  return (
    <>
      <div className="mt-5 space-y-3">
        {blocks.length === 0 && (
          <p className="rounded-2xl bg-white/[0.04] p-4 text-sm text-paper-dim ring-1 ring-white/10">
            Empty page — add a title, paragraph, photo or video below.
          </p>
        )}
        {blocks.map((block, i) => (
          <BlockRow
            key={block.id}
            block={block}
            isFirst={i === 0}
            isLast={i === blocks.length - 1}
            onMove={(dir) => onMove(block.id, dir)}
            onRemove={() => onRemove(block.id)}
            onText={(text) => onText(block.id, text)}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
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
      </div>
    </>
  );
}

/** One content block with move/remove controls; text blocks are editable. */
function BlockRow({
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
