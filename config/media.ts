/**
 * Central media manifest.
 * ------------------------
 * Every image / video / logo used on the homepage is referenced from here.
 * To swap a placeholder for real media:
 *   1. Drop the real file into /public (e.g. /public/media/hero.mp4).
 *   2. Update the matching path below.
 * Nothing else needs to change — components read exclusively from this object.
 *
 * The hero `<video>` only renders when `hero.video` is a non-empty string.
 * Until then the animated poster stands in for the video loop.
 */
export const media = {
  logo: {
    /** Primary wordmark (used in the footer). */
    wordmark: "/placeholders/logo-wordmark.svg",
    /** Pure-white variant for very dark placements. */
    wordmarkMono: "/placeholders/logo-wordmark-mono.svg",
    /** Compact "NN" monogram (used in the header). */
    monogram: "/placeholders/logo-monogram.svg",
    /** Square app/favicon mark. */
    mark: "/placeholders/icon-mark.svg",
  },

  hero: {
    /** Full-bleed hero background photo. Swap this file to change the hero. */
    image: "/media/hero.jpg",
    /** Poster frame used if a video is set (below). */
    poster: "/placeholders/hero-poster.svg",
    /**
     * Optional muted, looping background video. Leave empty to use the photo.
     * Set to e.g. "/media/hero.mp4" once real footage exists.
     */
    video: "",
    videoType: "video/mp4",
  },

  about: {
    portrait: "/placeholders/founder-portrait.svg",
  },

  services: {
    /** Background photo behind the "What we do" section. */
    background: "/media/what-we-do.jpg",
  },

  /** 1-1 Training page photos. */
  oneToOne: {
    hero: "/media/one-to-one-hero.jpg", // two trainers + dogs
    understand: "/media/what-we-do.jpg", // reuses the trainer + dog photo
    report: "/placeholders/walk-train-report.svg", // shared report-card mockup
    consultation: "/media/one-to-one-consult.jpg", // running puppy
  },

  /** Walk & Train page photos. */
  walkTrain: {
    hero: "/media/walk-train-hero.jpg", // white van in a field
    van: "/media/walk-train-van.jpg", // dog in a transport crate
    report: "/placeholders/walk-train-report.svg", // phone showing the report card
    meetGreet: "/media/what-we-do.jpg", // reuses the trainers + dogs photo
  },

  leaveWhenReady: {
    /** Photo card in the "Leave when you're ready" section. */
    image: "/media/leave-when-ready.jpg", // rottweiler in the forest
  },

  dogs: [
    "/placeholders/dog-1.svg",
    "/placeholders/dog-2.svg",
    "/placeholders/dog-3.svg",
  ],

  avatars: [
    "/placeholders/avatar-1.svg",
    "/placeholders/avatar-2.svg",
    "/placeholders/avatar-3.svg",
  ],

  /** Small avatars for the reviews marquee — swap for real customer-dog photos. */
  customerAvatars: Array.from(
    { length: 20 },
    (_, i) => `/placeholders/dog-avatar-${String(i + 1).padStart(2, "0")}.svg`
  ),
} as const;

export type Media = typeof media;
