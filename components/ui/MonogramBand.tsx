import { media } from "@/config/media";

/**
 * Large NN monogram brand band with a photo masked into the letter strokes.
 * The SVG mask reveals the image only where the (reversed-N + N) strokes are;
 * everywhere else stays the footer background. Decorative only.
 */
export function MonogramBand() {
  return (
    <div className="px-6 pb-10 pt-4" aria-hidden="true">
      <svg
        viewBox="0 0 68 44"
        className="mx-auto block w-full max-w-2xl"
        role="presentation"
      >
        <defs>
          <mask id="nn-monogram-mask">
            <g
              stroke="#ffffff"
              strokeWidth="8"
              strokeLinecap="square"
              fill="none"
            >
              {/* reversed N */}
              <line x1="8" y1="6" x2="8" y2="38" />
              <line x1="8" y1="38" x2="26" y2="6" />
              <line x1="26" y1="6" x2="26" y2="38" />
              {/* N */}
              <line x1="42" y1="6" x2="42" y2="38" />
              <line x1="42" y1="6" x2="60" y2="38" />
              <line x1="60" y1="6" x2="60" y2="38" />
            </g>
          </mask>
        </defs>
        <image
          href={media.footer.monogramPhoto}
          x="0"
          y="0"
          width="68"
          height="44"
          preserveAspectRatio="xMidYMid slice"
          mask="url(#nn-monogram-mask)"
          opacity="0.65"
        />
      </svg>
    </div>
  );
}
