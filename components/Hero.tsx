"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Button } from "./ui/Button";
import { ChevronDownIcon } from "./ui/Icons";
import { media } from "@/config/media";

const HEADLINE = ["Happy.", "Healthy.", "Dogs."];

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden"
    >
      {/* Full-bleed background media */}
      <div className="absolute inset-0 -z-10 bg-ink" aria-hidden="true">
        {media.hero.video ? (
          <video
            className="h-full w-full object-cover"
            poster={media.hero.poster}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          >
            <source src={media.hero.video} type={media.hero.videoType} />
          </video>
        ) : (
          // Animated SVG poster stands in for the muted video loop.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.hero.poster}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
        <div className="media-overlay absolute inset-0" />
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-32 sm:px-6 sm:pb-28">
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-4 text-xs font-semibold uppercase tracking-[0.35em] text-accent"
        >
          Tynemouth · Backworth · North East
        </motion.p>

        <h1 className="display-heading text-paper text-[clamp(3rem,15vw,8rem)]">
          {HEADLINE.map((word, i) => (
            <motion.span
              key={word}
              className="block"
              initial={reduce ? false : { opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.1 + i * 0.12,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {word}
            </motion.span>
          ))}
        </h1>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 max-w-md text-lg text-paper/85 sm:text-xl"
        >
          Dog training through engagement and motivation.
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.62, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8"
        >
          <Button href="#book" size="lg">
            Book Training Today
          </Button>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <a
        href="#about"
        aria-label="Scroll to learn more"
        className="group absolute inset-x-0 bottom-5 mx-auto flex w-11 flex-col items-center gap-1 text-paper/70 transition-colors hover:text-accent"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em]">
          Scroll
        </span>
        <motion.span
          animate={reduce ? undefined : { y: [0, 6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDownIcon width={20} height={20} />
        </motion.span>
      </a>
    </section>
  );
}
