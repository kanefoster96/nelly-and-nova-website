/** Mirrors the website's tokens in app/globals.css so web and app feel the same. */
export const colors = {
  ink: "#0a0a0a",
  inkSoft: "#121212",
  inkRaised: "#1a1a1a",
  paper: "#f5f2ea",
  paperDim: "#b8b4ab",
  accent: "#ffffff",
  accentInk: "#0a0a0a",
  line: "rgba(245, 242, 234, 0.12)",
} as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { md: 14, lg: 20, pill: 999 } as const;
