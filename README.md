# Nelly & Nova — Website

Mobile-first marketing site for **Nelly & Nova**, a dog training company in the
North East of England (Tynemouth, Backworth & surrounding areas).

Phase one is the **homepage**. The project is built component-first and
touch-friendly so it can later be wrapped as a native mobile app with
[Capacitor](https://capacitorjs.com/).

## Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** (theme tokens defined in `app/globals.css`)
- **Framer Motion** for scroll/entrance animations & gentle parallax

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run build    # production build (fully static)
npm run start    # serve the production build
npm run lint     # eslint
npm run placeholders   # regenerate the placeholder media in public/placeholders/
```

## Project structure

```
app/
  layout.tsx        # fonts (Manrope + Archivo), metadata, <html>/<body>
  page.tsx          # assembles the homepage sections in order
  globals.css       # ← design tokens (colours, fonts) + base styles
  icon.svg          # favicon / app mark

components/         # one file per homepage section
  Nav.tsx           # 1. sticky bar, logo + hamburger, Book Now
  Hero.tsx          # 2. full-screen video/poster, "HAPPY. HEALTHY. DOGS."
  About.tsx         # 3. founder intro (Charlotte) + portrait
  WalkAndTrain.tsx  # 4. feature section, skills checklist
  OneToOne.tsx      # 5. 1-1 training
  AreasCovered.tsx  # 6. areas grid
  Testimonials.tsx  # 7. review carousel
  FinalCTA.tsx      # 8. "Ready to start?" band
  Footer.tsx        # 9. links, contact, socials, copyright
  ui/               # reusable primitives
    Button.tsx           # rounded button/link, 44px+ tap targets, variants
    Reveal.tsx           # fade/slide-in on scroll (respects reduced motion)
    Parallax.tsx         # gentle background parallax (respects reduced motion)
    SectionBackground.tsx# full-bleed lazy image + parallax + dark overlay
    Wordmark.tsx         # NELLY & NOVA logo
    Icons.tsx            # inline currentColor icons

config/             # central, non-code content & configuration
  media.ts          # ← every image/video/logo path (swap media here)
  site.ts           # ← nav links, areas, contact, socials, copy
  theme.ts          # JS mirror of a few theme colours

public/placeholders/  # clearly-labelled placeholder media (all swappable)
scripts/generate-placeholders.mjs  # regenerates the placeholders
```

## Swapping in real media

All media is referenced from **`config/media.ts`** — components never hardcode
paths. To replace a placeholder:

1. Drop the real file into `/public` (e.g. `public/media/hero.mp4`,
   `public/media/charlotte.jpg`).
2. Update the matching path in `config/media.ts`.

Nothing else changes. For example, to enable a real hero **video**, set:

```ts
// config/media.ts
hero: {
  poster: "/media/hero-poster.jpg",
  video: "/media/hero.mp4",   // empty string = show the animated poster only
  videoType: "video/mp4",
}
```

When `hero.video` is a non-empty string the `<Hero>` renders a muted,
autoplaying, looping `<video>` with the poster frame; otherwise the animated
placeholder poster stands in.

> Placeholder images are SVGs, so `next.config.ts` serves images unoptimized
> (also required for a future Capacitor static export). Once you ship real
> raster media on a server-rendered deploy, you can re-enable image
> optimization there.

## Changing the accent colour (re-branding)

The warm amber/gold accent is defined **once** as a Tailwind theme token in
`app/globals.css`:

```css
@theme {
  --color-accent: #e8b15a;         /* ← change this */
  --color-accent-strong: #f0c17a;  /* hover state */
  --color-accent-ink: #1a1206;     /* text colour that sits on the accent */
}
```

Change `--color-accent` and every `text-accent` / `bg-accent` / `border-accent`
/ `ring-accent` across the site updates. The near-black background
(`--color-ink`, `#0A0A0A`) and off-white text (`--color-paper`) live in the same
block. If a colour is also used from JavaScript (e.g. the browser theme-colour),
mirror the new value in `config/theme.ts`.

## Content quick-edits

- **Nav links, service areas, contact details, social links, tagline** →
  `config/site.ts`
- **Testimonials** → the `TESTIMONIALS` array in `components/Testimonials.tsx`
- **Walk & Train skills list** → the `SKILLS` array in
  `components/WalkAndTrain.tsx`

All booking CTAs currently point at `#book` (see `BOOKING_HREF` in
`config/site.ts`) — wire them to the real booking flow later.

## Accessibility & mobile

- Semantic landmarks, `alt` text, visible keyboard focus rings, and a
  keyboard-navigable menu (Escape closes, body scroll locks while open).
- Every interactive element is a **44px+** tap target.
- All motion is disabled automatically when the user has
  `prefers-reduced-motion` set.

## Native app (later)

To wrap with Capacitor, add `output: "export"` to `next.config.ts`, run
`npm run build`, then point Capacitor at the exported `out/` directory. The site
already avoids browser-only assumptions that would block a native wrap.

---

© 2026 Nelly & Nova.
