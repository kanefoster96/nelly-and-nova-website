/**
 * Site-wide content & configuration.
 * ----------------------------------
 * Navigation, service areas, contact details and social links live here so
 * copy can be updated without touching component markup. All booking-style
 * CTAs point at "#" for now — wire them to the real booking flow later.
 */

export const BOOKING_HREF = "#book";

export type NavLink = { label: string; href: string };

// Menu items are added back here as page sections are built, top to bottom.
// While empty, the header shows just the logo and the Book Now button.
export const navLinks: NavLink[] = [];

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

// Footer quick links — repopulated as sections are built.
export const footerLinks: NavLink[] = [];

export const site = {
  name: "Nelly & Nova",
  tagline: "Dog training in Tynemouth, Backworth & local areas",
  description:
    "Dog training through engagement and motivation across Tynemouth, Backworth and the North East. Walk & Train day training, 1-1 sessions and confidence building.",
  region: "North East England",
  year: 2026,
};
