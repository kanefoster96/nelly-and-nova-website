import type { DrillBlock } from "@/config/homeworkLibrary";

/**
 * A drill's page content as the owner sees it — the trainer's blog-style blocks
 * (headings, paragraphs, photos, videos) rendered read-only, so they can follow
 * exactly how to practise. Used full-page on /profile/practice.
 */
export function DrillBlocks({ blocks }: { blocks: DrillBlock[] }) {
  if (blocks.length === 0) {
    return (
      <p className="text-sm text-paper-dim">
        Your trainer will add photos and step-by-step notes here soon.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {blocks.map((block) => {
        switch (block.type) {
          case "heading":
            return (
              <h2 key={block.id} className="text-lg font-semibold text-paper">
                {block.text}
              </h2>
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
              <img key={block.id} src={block.url} alt="" className="w-full rounded-2xl" />
            );
          case "video":
            return (
              <video key={block.id} src={block.url} controls className="w-full rounded-2xl bg-black" />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
