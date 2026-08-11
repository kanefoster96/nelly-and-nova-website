import Image from "next/image";
import { media } from "@/config/media";

/**
 * Infinite marquee of small round avatars (customer dogs). The track holds two
 * identical copies and shifts by one copy (-50%) for a seamless loop. Animation
 * is disabled under prefers-reduced-motion (see globals.css .marquee-track).
 */
export function AvatarMarquee({
  avatars = media.customerAvatars,
  /** Seconds for one full loop — lower is faster. */
  durationSeconds = 22,
  className = "",
}: {
  avatars?: readonly string[];
  durationSeconds?: number;
  className?: string;
}) {
  return (
    <div
      className={`relative flex overflow-hidden py-2 ${className}`}
      aria-hidden="true"
    >
      <div
        className="marquee-track flex shrink-0 items-center gap-4 pr-4"
        style={{ animationDuration: `${durationSeconds}s` }}
      >
        {[0, 1].map((copy) => (
          <ul key={copy} className="flex shrink-0 items-center gap-4">
            {avatars.map((src, i) => (
              <li key={`${copy}-${i}`} className="shrink-0">
                <span className="block h-12 w-12 overflow-hidden rounded-full ring-1 ring-white/10 sm:h-14 sm:w-14">
                  <Image
                    src={src}
                    alt=""
                    width={56}
                    height={56}
                    className="h-full w-full object-cover"
                  />
                </span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
