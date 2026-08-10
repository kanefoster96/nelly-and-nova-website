import Image from "next/image";
import { Parallax } from "./Parallax";

type SectionBackgroundProps = {
  src: string;
  /** Parallax drift distance in px (0 disables motion). */
  parallax?: number;
  /** Show the dark gradient overlay for text legibility. */
  overlay?: boolean;
  /** Load eagerly (use only for above-the-fold media). */
  priority?: boolean;
  className?: string;
};

/**
 * Full-bleed, lazy-loaded background media with a gentle parallax drift and a
 * dark gradient overlay. Purely decorative (aria-hidden). The image is scaled
 * slightly beyond the frame so parallax never exposes an edge.
 */
export function SectionBackground({
  src,
  parallax = 60,
  overlay = true,
  priority = false,
  className = "",
}: SectionBackgroundProps) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-ink ${className}`}
      aria-hidden="true"
    >
      <Parallax distance={parallax} className="absolute inset-0">
        {/* Oversized so the parallax drift stays covered. */}
        <div className="absolute inset-x-0 -inset-y-[8%]">
          <Image
            src={src}
            alt=""
            fill
            priority={priority}
            sizes="100vw"
            className="object-cover"
          />
        </div>
      </Parallax>
      {overlay && <div className="media-overlay absolute inset-0" />}
    </div>
  );
}
