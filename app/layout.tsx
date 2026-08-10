import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { site } from "@/config/site";
import { theme } from "@/config/theme";

// Body / paragraph typeface. (Titles use a Helvetica system stack — see globals.css.)
const body = Outfit({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${site.name} — Dog Training in Tynemouth & the North East`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  keywords: [
    "dog training",
    "puppy training",
    "Walk and Train",
    "Tynemouth",
    "Backworth",
    "North East",
  ],
  openGraph: {
    title: `${site.name} — Dog Training`,
    description: site.description,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: theme.colors.ink,
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${body.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-ink text-paper antialiased">
        {children}
      </body>
    </html>
  );
}
