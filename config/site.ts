/**
 * Site-wide content & configuration.
 * ----------------------------------
 * Navigation, service areas, contact details and social links live here so
 * copy can be updated without touching component markup. All booking-style
 * CTAs point at "#" for now — wire them to the real booking flow later.
 */

export const BOOKING_HREF = "#book";

export type NavLink = { label: string; href: string };

export const navLinks: NavLink[] = [
  { label: "Walk & Train", href: "#walk-and-train" },
  { label: "1-1 Training", href: "#one-to-one" },
  { label: "Areas", href: "#areas" },
  { label: "About", href: "#about" },
];

/** Service areas covered across the North East. */
export const areas: string[] = [
  "North Shields",
  "Wallsend",
  "Tynemouth",
  "Cullercoats",
  "Whitley Bay",
  "Shiremoor",
  "Backworth",
  "Holywell",
  "Cramlington",
];

export const contact = {
  phone: "+44 0000 000000",
  phoneLabel: "07000 000000",
  email: "hello@nellyandnova.co.uk",
};

export type SocialLink = { label: string; href: string; icon: "facebook" | "instagram" };

export const socials: SocialLink[] = [
  { label: "Facebook", href: "#", icon: "facebook" },
  { label: "Instagram", href: "#", icon: "instagram" },
];

export const footerLinks: NavLink[] = [
  { label: "Walk & Train", href: "#walk-and-train" },
  { label: "1-1 Training", href: "#one-to-one" },
  { label: "Areas", href: "#areas" },
  { label: "About", href: "#about" },
  { label: "Policies", href: "#" },
];

export const site = {
  name: "Nelly & Nova",
  tagline: "Dog training in Tynemouth, Backworth & local areas",
  description:
    "Dog training through engagement and motivation across Tynemouth, Backworth and the North East. Walk & Train day training, 1-1 sessions and confidence building.",
  region: "North East England",
  year: 2026,
};
