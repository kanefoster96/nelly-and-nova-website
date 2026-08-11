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

  leaveWhenReady: {
    /** Photo card in the "Leave when you're ready" section. Swap for a real
     * photo: drop it in /public/media and point this at it (e.g. "/media/leave.jpg"). */
    image: "/placeholders/leave-when-ready.svg",
  },

  walkAndTrain: {
    background: "/placeholders/walk-train-bg.svg",
  },

  oneToOne: {
    background: "/placeholders/one-to-one-bg.svg",
  },

  finalCta: {
    background: "/placeholders/final-cta-bg.svg",
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
