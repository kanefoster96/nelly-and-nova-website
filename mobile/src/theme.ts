// Same shape as the Kanvas Academy app's lib/theme.ts so screens can be
// styled the same way, filled with Nelly & Nova's palette (the website's
// app/globals.css tokens). Dark only.
export const colors = {
  background: "#0a0a0a",
  surface: "#121212",
  foreground: "#f5f2ea",
  muted: "rgba(245, 242, 234, 0.6)",
  border: "rgba(245, 242, 234, 0.1)",
  accent: "#f5f2ea",
  accentForeground: "#0a0a0a",
  danger: "#e11d33",
  dangerForeground: "#f5f2ea",
  success: "#22c55e",
  warning: "#f59e0b",
} as const;

/** Row highlight while pressed. */
export const pressedBg = "rgba(245,245,242,0.05)";

/**
 * Glass — the grey buttons: see-through with a hairline edge. (The website
 * also blurs what's behind; the app would need expo-blur, a native module,
 * for that — so here it's the tint and edge only.)
 */
export const glass = {
  backgroundColor: "rgba(255,255,255,0.08)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.16)",
} as const;
