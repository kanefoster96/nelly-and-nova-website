/**
 * Generates clearly-labelled placeholder media for Nelly & Nova.
 *
 * These are intentionally obvious placeholders (labelled "PLACEHOLDER") so it is
 * easy to see what needs replacing. To swap in real media, drop real files into
 * public/placeholders/ (or anywhere) and update the paths in config/media.ts.
 *
 * Run with: node scripts/generate-placeholders.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "placeholders");
mkdirSync(OUT, { recursive: true });

const BG = "#141414";
const BG2 = "#0f0f0f";
const ACCENT = "#e8b15a";
const INK = "#f5f2ea";
const MUTED = "#8a8a8a";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A generic "photo" placeholder tile with a paw glyph + label. */
function photo({ w, h, label, sub = "PLACEHOLDER PHOTO", id }) {
  const cx = w / 2;
  const cy = h / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)} placeholder">
  <defs>
    <linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BG}"/>
      <stop offset="1" stop-color="${BG2}"/>
    </linearGradient>
    <pattern id="p${id}" width="46" height="46" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="46" height="46" fill="none"/>
      <line x1="0" y1="0" x2="0" y2="46" stroke="${ACCENT}" stroke-opacity="0.05" stroke-width="14"/>
    </pattern>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g${id})"/>
  <rect width="${w}" height="${h}" fill="url(#p${id})"/>
  <g transform="translate(${cx}, ${cy - 34})" fill="${ACCENT}" fill-opacity="0.55">
    <circle cx="-26" cy="-10" r="9"/>
    <circle cx="-9" cy="-20" r="9"/>
    <circle cx="9" cy="-20" r="9"/>
    <circle cx="26" cy="-10" r="9"/>
    <path d="M0 -8 C 18 -8 30 6 30 20 C 30 34 16 40 0 40 C -16 40 -30 34 -30 20 C -30 6 -18 -8 0 -8 Z"/>
  </g>
  <text x="${cx}" y="${cy + 34}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" letter-spacing="2" fill="${INK}">${esc(label.toUpperCase())}</text>
  <text x="${cx}" y="${cy + 58}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" letter-spacing="3" fill="${MUTED}">${esc(sub)}</text>
</svg>`;
}

/** Full-bleed background placeholder (landscape). */
function background({ w, h, label, id }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(label)} placeholder">
  <defs>
    <radialGradient id="rg${id}" cx="30%" cy="28%" r="90%">
      <stop offset="0" stop-color="#20211d"/>
      <stop offset="55%" stop-color="${BG}"/>
      <stop offset="100%" stop-color="${BG2}"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#rg${id})"/>
  <g stroke="${ACCENT}" stroke-opacity="0.07" stroke-width="2">
    ${Array.from({ length: 9 }, (_, i) => `<line x1="${(i * w) / 8}" y1="0" x2="${(i * w) / 8 - 160}" y2="${h}"/>`).join("\n    ")}
  </g>
  <text x="50%" y="50%" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" letter-spacing="4" fill="${INK}" fill-opacity="0.9">${esc(label.toUpperCase())}</text>
  <text x="50%" y="calc(50% + 32px)" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="13" letter-spacing="4" fill="${MUTED}">PLACEHOLDER BACKGROUND</text>
</svg>`;
}

/** Animated poster that stands in for the hero video (muted loop). */
function heroPoster({ w = 1600, h = 2000 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Hero video placeholder">
  <defs>
    <radialGradient id="hg" cx="50%" cy="34%" r="80%">
      <stop offset="0" stop-color="#26241d"/>
      <stop offset="55%" stop-color="#111111"/>
      <stop offset="100%" stop-color="#080808"/>
    </radialGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${ACCENT}" stop-opacity="0"/>
      <stop offset="0.5" stop-color="${ACCENT}" stop-opacity="0.14"/>
      <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
      <animateTransform attributeName="gradientTransform" type="translate" from="-1 0" to="1 0" dur="6s" repeatCount="indefinite"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#hg)"/>
  <rect width="${w}" height="${h}" fill="url(#sheen)"/>
  <g transform="translate(${w / 2}, ${h / 2 - 120})" fill="${ACCENT}" fill-opacity="0.5">
    <circle cx="-52" cy="-20" r="18"/>
    <circle cx="-18" cy="-40" r="18"/>
    <circle cx="18" cy="-40" r="18"/>
    <circle cx="52" cy="-20" r="18"/>
    <path d="M0 -16 C 36 -16 60 12 60 40 C 60 68 32 80 0 80 C -32 80 -60 68 -60 40 C -60 12 -36 -16 0 -16 Z"/>
  </g>
  <text x="50%" y="52%" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="800" letter-spacing="6" fill="${INK}">HERO VIDEO</text>
  <text x="50%" y="55.5%" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="20" letter-spacing="8" fill="${MUTED}">PLACEHOLDER LOOP</text>
</svg>`;
}

/** NELLY & NOVA wordmark logo. */
function wordmark({ ink = INK } = {}) {
  const w = 520;
  const h = 120;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Nelly and Nova wordmark">
  <g transform="translate(30, 60)" fill="${ACCENT}">
    <circle cx="-8" cy="-12" r="5.5"/>
    <circle cx="6" cy="-19" r="5.5"/>
    <circle cx="20" cy="-19" r="5.5"/>
    <circle cx="34" cy="-12" r="5.5"/>
    <path d="M13 -10 C 24 -10 31 -1 31 8 C 31 17 22 21 13 21 C 4 21 -5 17 -5 8 C -5 -1 2 -10 13 -10 Z"/>
  </g>
  <text x="86" y="52" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="800" letter-spacing="3" fill="${ink}">NELLY &amp; NOVA</text>
  <text x="88" y="82" font-family="Arial, Helvetica, sans-serif" font-size="12.5" font-weight="600" letter-spacing="7" fill="${ACCENT}">DOG TRAINING</text>
  <text x="88" y="100" font-family="Arial, Helvetica, sans-serif" font-size="9" letter-spacing="3" fill="${MUTED}">PLACEHOLDER LOGO</text>
</svg>`;
}

/** Compact square app icon / favicon mark. */
function iconMark() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Nelly and Nova icon">
  <rect width="64" height="64" rx="16" fill="#0a0a0a"/>
  <g transform="translate(32, 34)" fill="${ACCENT}">
    <circle cx="-13" cy="-8" r="4.5"/>
    <circle cx="-4" cy="-14" r="4.5"/>
    <circle cx="4" cy="-14" r="4.5"/>
    <circle cx="13" cy="-8" r="4.5"/>
    <path d="M0 -6 C 9 -6 15 1 15 8 C 15 15 8 18 0 18 C -8 18 -15 15 -15 8 C -15 1 -9 -6 0 -6 Z"/>
  </g>
</svg>`;
}

const files = {
  "logo-wordmark.svg": wordmark({ ink: INK }),
  "logo-wordmark-mono.svg": wordmark({ ink: "#ffffff" }),
  "icon-mark.svg": iconMark(),
  "hero-poster.svg": heroPoster(),
  "founder-portrait.svg": photo({ w: 900, h: 1100, label: "Charlotte", sub: "FOUNDER PORTRAIT PLACEHOLDER", id: "founder" }),
  "walk-train-bg.svg": background({ w: 1600, h: 1200, label: "Walk & Train", id: "wt" }),
  "one-to-one-bg.svg": background({ w: 1600, h: 1200, label: "1-1 Training", id: "oto" }),
  "final-cta-bg.svg": background({ w: 1600, h: 900, label: "Book Now", id: "cta" }),
  "dog-1.svg": photo({ w: 900, h: 900, label: "Dog Photo 1", id: "d1" }),
  "dog-2.svg": photo({ w: 900, h: 900, label: "Dog Photo 2", id: "d2" }),
  "dog-3.svg": photo({ w: 900, h: 900, label: "Dog Photo 3", id: "d3" }),
  "avatar-1.svg": photo({ w: 200, h: 200, label: "A", sub: "AVATAR", id: "a1" }),
  "avatar-2.svg": photo({ w: 200, h: 200, label: "B", sub: "AVATAR", id: "a2" }),
  "avatar-3.svg": photo({ w: 200, h: 200, label: "C", sub: "AVATAR", id: "a3" }),
};

for (const [name, contents] of Object.entries(files)) {
  writeFileSync(join(OUT, name), contents.trim() + "\n", "utf8");
}

console.log(`Generated ${Object.keys(files).length} placeholder assets in public/placeholders/`);
