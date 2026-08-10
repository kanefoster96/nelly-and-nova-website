import Image from "next/image";
import Link from "next/link";
import { media } from "@/config/media";
import { site } from "@/config/site";

type WordmarkProps = {
  className?: string;
  /** Rendered pixel height; width scales from the intrinsic ratio. */
  height?: number;
  /** Use the pure-white variant (for the darkest placements). */
  mono?: boolean;
  /** Wrap in a link to the given href (e.g. "#top"). */
  href?: string;
  priority?: boolean;
};

/**
 * NELLY & NOVA wordmark. Swap the underlying file in config/media.ts.
 */
export function Wordmark({
  className = "",
  height = 40,
  mono = false,
  href,
  priority = false,
}: WordmarkProps) {
  const src = mono ? media.logo.wordmarkMono : media.logo.wordmark;
  // Intrinsic ratio of the placeholder wordmark is 520 x 120.
  const width = Math.round((height * 520) / 120);

  const img = (
    <Image
      src={src}
      alt={`${site.name} logo`}
      width={width}
      height={height}
      priority={priority}
      className="h-auto w-auto"
      style={{ height, width: "auto" }}
    />
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`inline-flex items-center ${className}`}
        aria-label={`${site.name} — home`}
      >
        {img}
      </Link>
    );
  }

  return <span className={`inline-flex items-center ${className}`}>{img}</span>;
}
