/**
 * Nelly & Nova — colour tokens.
 * Mirrors the web app's design tokens (see `app/globals.css` in the root
 * website project) so the native app and the website stay on-brand.
 * Change a value here to re-brand the whole app.
 */
export const colors = {
  ink: "#0a0a0a", // near-black background
  inkSoft: "#121212", // slightly raised surfaces
  inkRaised: "#1a1a1a", // cards / raised surfaces
  paper: "#f5f2ea", // off-white text
  paperDim: "#b8b4ab", // muted text
  accent: "#ffffff", // primary action colour
  accentStrong: "#d9d9d9", // pressed state
  accentInk: "#0a0a0a", // text colour that sits on the accent
  border: "rgba(255,255,255,0.1)",
  fieldBg: "rgba(255,255,255,0.04)",
  danger: "#f87171",
  dangerBg: "rgba(239,68,68,0.1)",
  dangerBorder: "rgba(239,68,68,0.2)",
} as const;
