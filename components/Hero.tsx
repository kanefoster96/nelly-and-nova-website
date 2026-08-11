"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "./ui/Button";
import { Marquee } from "./ui/Marquee";
import { benefitIcons, StarIcon } from "./ui/Icons";
import { media } from "@/config/media";
import { heroBenefits, reviews, BOOKING_HREF } from "@/config/site";

// Vertical dark gradient: darkens the sky (behind the headline) and the base
// (behind the benefits) while keeping the dogs in the middle legible.
const GRADIENT =
  "linear-gradient(to bottom, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.4) 18%, rgba(10,10,10,0.12) 40%, rgba(10,10,10,0.5) 64%, rgba(10,10,10,0.9) 84%, #0a0a0a 100%)";

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section id="top" className="relative isolate overflow-hidden bg-ink">
      {/* Full-bleed background photo */}
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        {media.hero.video ? (
          <video
            className="h-full w-full object-cover object-center"
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
          <Image
            src={media.hero.image}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[center_42%]"
          />
        )}
        <div className="absolute inset-0" style={{ background: GRADIENT }} />
      </div>

      {/* Content */}
      <div className="mx-auto flex min-h-[100svh] max-w-3xl flex-col px-4 pb-8 pt-28 sm:pt-32">
        {/* Headline block */}
        <motion.div
          className="text-center"
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="display-heading text-paper text-[clamp(1.4rem,6.7vw,4.5rem)] whitespace-nowrap">
            Happy. Healthy. Dogs.
          </h1>
          <p className="mx-auto mt-3 max-w-md text-base text-paper/85 sm:text-lg">
            Training dogs through engagement and motivation.
          </p>
          <div className="mt-6 flex justify-center">
            <Button href={BOOKING_HREF} variant="frosted" size="lg">
              Book a Free Visit
            </Button>
          </div>
        </motion.div>

        {/* Spacer — lets the dogs show through */}
        <div className="min-h-[34vh] flex-1" />

        {/* Trust badges + reviews */}
        <div className="mx-auto w-full max-w-md">
          <ul className="mx-auto grid w-fit grid-cols-2 gap-x-8 gap-y-3">
            {heroBenefits.map((b, i) => {
              const Icon = benefitIcons[b.icon];
              const last = i === heroBenefits.length - 1;
              return (
                <li
                  key={b.label}
                  className={`flex items-center gap-2.5 text-sm text-paper sm:text-base ${
                    last ? "col-span-2 justify-center" : ""
                  }`}
                >
                  <Icon width={20} height={20} className="shrink-0 text-paper" />
                  <span>{b.label}</span>
                </li>
              );
            })}
          </ul>

          {/* Google reviews card */}
          <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/40 px-5 py-4 backdrop-blur-md">
            <div>
              <div className="flex gap-0.5 text-[#f5b301]">
                {Array.from({ length: reviews.stars }).map((_, i) => (
                  <StarIcon key={i} width={18} height={18} />
                ))}
              </div>
              <p className="mt-1.5 text-sm text-paper/85">{reviews.text}</p>
            </div>
            <span className="text-xl font-semibold tracking-tight text-paper">
              Google
            </span>
          </div>
        </div>
      </div>

      {/* Scrolling keyword marquee */}
      <Marquee />
    </section>
  );
}
