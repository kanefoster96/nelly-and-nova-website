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
    /** Primary wordmark (used in nav + footer). */
    wordmark: "/placeholders/logo-wordmark.svg",
    /** Pure-white variant for very dark placements. */
    wordmarkMono: "/placeholders/logo-wordmark-mono.svg",
    /** Square app/favicon mark. */
    mark: "/placeholders/icon-mark.svg",
  },

  hero: {
    /** Poster frame shown before/while the video loads (and if no video set). */
    poster: "/placeholders/hero-poster.svg",
    /**
     * Muted, looping background video. Leave empty to use the poster only.
     * Set to e.g. "/media/hero.mp4" once real footage exists.
     */
    video: "",
    videoType: "video/mp4",
  },

  about: {
    portrait: "/placeholders/founder-portrait.svg",
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
} as const;

export type Media = typeof media;
