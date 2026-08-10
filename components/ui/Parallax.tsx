"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { useRef, type ReactNode } from "react";

type ParallaxProps = {
  children: ReactNode;
  /**
   * How far the layer drifts across the full scroll pass, in pixels.
   * Kept small for a subtle, performant effect on mobile.
   */
  distance?: number;
  className?: string;
};

/**
 * Gentle vertical parallax for full-bleed background media.
 * The child is oversized (see usage) so the drift never reveals an edge.
 * Renders static when the user prefers reduced motion.
 */
export function Parallax({ children, distance = 60, className }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Drift from -distance/2 to +distance/2 as the section passes through view.
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    [-distance / 2, distance / 2]
  );

  return (
    <div ref={ref} className={className} aria-hidden="true">
      <motion.div
        className="absolute inset-0 will-change-transform"
        style={reduce ? undefined : { y }}
      >
        {children}
      </motion.div>
    </div>
  );
}
