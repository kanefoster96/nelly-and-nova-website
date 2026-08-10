/**
 * Theme token reference.
 * ----------------------
 * The single source of truth for colours & fonts is `app/globals.css`
 * (the Tailwind v4 `@theme` block). These JS constants mirror a few of those
 * values for the rare places that need a colour in JavaScript rather than a
 * Tailwind class — e.g. the browser theme-colour meta tag or an inline SVG.
 *
 * To re-brand: change `--color-accent` in app/globals.css. Update the mirror
 * below only if a JS-side consumer needs the new value too.
 */
export const theme = {
  colors: {
    ink: "#0a0a0a",
    paper: "#f5f2ea",
    accent: "#e8b15a",
  },
} as const;
