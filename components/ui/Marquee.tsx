import { marqueeWords } from "@/config/site";

/**
 * Infinite horizontal marquee of keywords. The track holds two identical
 * copies of the word list and shifts by exactly one copy (-50%), so the loop
 * is seamless. Animation is disabled under prefers-reduced-motion (see
 * globals.css), leaving a static row.
 */
export function Marquee() {
  const items = marqueeWords;
  return (
    <div
      className="relative flex overflow-hidden border-t border-white/10 py-4 select-none"
      aria-hidden="true"
    >
      <div className="marquee-track flex shrink-0 items-center whitespace-nowrap">
        {[0, 1].map((copy) => (
          <ul key={copy} className="flex shrink-0 items-center">
            {items.map((word) => (
              <li
                key={`${copy}-${word}`}
                className="mx-6 text-lg font-extrabold uppercase tracking-tight text-paper/80 sm:text-xl"
              >
                {word}.
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
