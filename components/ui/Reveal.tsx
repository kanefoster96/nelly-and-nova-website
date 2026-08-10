"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

type Direction = "up" | "down" | "left" | "right" | "none";

const offsets: Record<Direction, { x?: number; y?: number }> = {
  up: { y: 28 },
  down: { y: -28 },
  left: { x: 28 },
  right: { x: -28 },
  none: {},
};

type RevealProps = {
  children: ReactNode;
  /** Direction the content slides in from. */
  from?: Direction;
  /** Stagger delay in seconds. */
  delay?: number;
  /** Wrapper element tag. */
  as?: "div" | "section" | "li" | "span";
  className?: string;
} & Omit<HTMLMotionProps<"div">, "children">;

/**
 * Fade + slide-in on scroll. Animates once when it enters the viewport.
 * Fully disabled (renders static) when the user prefers reduced motion.
 */
export function Reveal({
  children,
  from = "up",
  delay = 0,
  as = "div",
  className,
  ...rest
}: RevealProps) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] as typeof motion.div;

  if (reduce) {
    const Tag = as;
    return (
      <Tag className={className}>{children}</Tag>
    );
  }

  const offset = offsets[from];

  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}
