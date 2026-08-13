"use client";

import { useEffect } from "react";
import { CloseIcon } from "@/components/ui/Icons";
import type { DrillBlock } from "@/config/homeworkLibrary";

/**
 * A drill's page as the owner sees it — the trainer's blog-style blocks
 * (headings, paragraphs, photos, videos) rendered read-only, so they can follow
 * exactly how to practise between sessions.
 */
export function DrillPage({
  name,
  blocks,
  onClose,
}: {
  name: string;
  blocks: DrillBlock[];
  onClose: () => void;
}) {
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

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${name} drill`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl bg-ink-soft ring-1 ring-white/15 sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <h2 className="display-heading text-xl text-paper">{name}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-paper/70 hover:bg-white/10 hover:text-paper"
          >
            <CloseIcon width={20} height={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {blocks.length === 0 ? (
            <p className="text-sm text-paper-dim">
              Your trainer will add photos and step-by-step notes here soon.
            </p>
          ) : (
            blocks.map((block) => {
              switch (block.type) {
                case "heading":
                  return (
                    <h3 key={block.id} className="text-lg font-semibold text-paper">
                      {block.text}
                    </h3>
                  );
                case "paragraph":
                  return (
                    <p key={block.id} className="text-sm leading-relaxed text-paper/85">
                      {block.text}
                    </p>
                  );
                case "image":
                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={block.id} src={block.url} alt="" className="w-full rounded-xl" />
                  );
                case "video":
                  return (
                    <video
                      key={block.id}
                      src={block.url}
                      controls
                      className="w-full rounded-xl bg-black"
                    />
                  );
                default:
                  return null;
              }
            })
          )}
        </div>
      </div>
    </div>
  );
}
