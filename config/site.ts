/**
 * Site-wide content & configuration.
 * ----------------------------------
 * Navigation, service areas, contact details and social links live here so
 * copy can be updated without touching component markup. All booking-style
 * CTAs point at "#" for now — wire them to the real booking flow later.
 */

export const BOOKING_HREF = "#book";
export const CONTACT_HREF = "#contact";

/** "We understand" pain points. `icon` maps to painIcons in components/ui/Icons.tsx. */
export type PainPoint = { icon: "paw" | "help" | "cross"; title: string; body: string };

export const understand = {
  heading: "We understand.",
  points: [
    {
      icon: "paw",
      title: "Walks aren't enjoyable.",
      body: "You get anxious or stressed taking your dog out, thinking about the challenge.",
    },
    {
      icon: "help",
      title: "Nothing seems to work.",
      body: "You've got a cupboard full of different leads you thought might give you more control, but nothing is changing.",
    },
    {
      icon: "cross",
      title: "You're stuck.",
      body: "You've heard conflicting advice, and now you're stuck in a loop.",
    },
  ] as PainPoint[],
  footer: "Tell us what you'd like help with, and we will show you exactly how to get there.",
  cta: "Contact Us",
};

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

/** "What we do" — tabbed services. */
export type ServiceTab = {
  id: string;
  label: string;
  subtitle: string;
  points: string[];
  cta: string;
  ctaHref: string;
};

export const services = {
  heading: "What we do.",
  tabs: [
    {
      id: "walk-train",
      label: "Walk & Train.",
      subtitle: "Full day training.",
      points: [
        "We collect and drop them off from your home",
        "We build confidence through structured, positive experiences.",
        "We work around other dogs, people and locations so your training holds up everywhere",
        "You get report cards with homework to continue the training at home",
      ],
      cta: "Book a Visit",
      ctaHref: BOOKING_HREF,
    },
    {
      id: "one-to-one",
      label: "1-1 Training.",
      subtitle: "Learn how to train your dog.",
      points: [
        "1 hour of training with you and your dog tailored to your goals",
        "We look at dog and handler skillsets so you feel confident training",
        'We cover general obedience explaining the "why" behind everything we teach',
        "Report card sent out after each session, so you can remember exactly what we covered",
      ],
      cta: "Book a Session",
      ctaHref: BOOKING_HREF,
    },
  ] as ServiceTab[],
  areaCta: "Check if we cover your area",
  areaHref: "#areas",
};

/** "Leave when you're ready" reassurance section. */
export const leaveWhenReady = {
  heading: "Leave when you're ready",
  intro:
    "Our training works by first teaching the foundations your dog needs, to be able to learn. We will show you how to communicate with them and how to improve the behaviours you feel are impossible to change. You'll start to understand why they act the way they do, and what you need to do to support them.",
  emphasis:
    "Most of our dog owners stay with us throughout their dog's journey. There is always something they can learn to give them a better, more confident life. However, once you feel confident enough to take over the training yourself, you can cancel anytime with no fees and no notice period.",
  caption: "Pay weekly via Direct Debit. Cancel anytime, no fees or notice.",
};

/** "How it works" steps. `icon` maps to stepIcons in components/ui/Icons.tsx. */
export type Step = { icon: "handshake" | "calendar" | "paw" | "home"; title: string; body: string };

export const howItWorks = {
  heading: "How it works.",
  steps: [
    {
      icon: "handshake",
      title: "Free Meet & Greet",
      body: "We will come out to meet you and your dog for free. Then we can see exactly what your struggles are and tell you how we will help before you pay anything. No commitment if you still need time to think.",
    },
    {
      icon: "calendar",
      title: "Choose your weekly slot",
      body: "When you decide to book, you can choose from our available days. There's a short waiver to complete, and payments are made via GoCardless (Direct Debit), cancel anytime.",
    },
    {
      icon: "paw",
      title: "Weekly training sessions",
      body: "Every week, we will collect your dog between 7:30 and 9:00 am. They'll get a full day of training before coming home between 4:00 and 5:30 pm.",
    },
    {
      icon: "home",
      title: "Homework & reports",
      body: "Every session includes a report card that tells you what we covered that day, what your dog did well/not so well, and a breakdown on how to continue the training at home. You'll have 24/7 access to our trainers via WhatsApp for any extra support. When you have the confidence to take over, you can cancel your membership any time with no cancellation fees or notices.",
    },
  ] as Step[],
};

export const contact = {
  phone: "+44 0000 000000",
  phoneLabel: "07000 000000",
  email: "hello@nellyandnova.co.uk",
  /** WhatsApp click-to-chat link — replace the number (international format, no +). */
  whatsapp: "https://wa.me/440000000000",
};

/** Hero trust badges. `icon` maps to benefitIcons in components/ui/Icons.tsx. */
export type Benefit = { label: string; icon: "message" | "close" | "card" | "insured" | "check" };

export const heroBenefits: Benefit[] = [
  { label: "24/7 Training Support", icon: "message" },
  { label: "Cancel Anytime", icon: "close" },
  { label: "Report Cards", icon: "card" },
  { label: "Fully Insured", icon: "insured" },
  { label: "Free Meet & Greet", icon: "check" },
];

export const reviews = {
  stars: 5,
  text: "5 stars based on Google Reviews",
};

/** Scrolling keyword marquee at the bottom of the hero. */
export const marqueeWords: string[] = [
  "Engagement",
  "Confidence",
  "Recall",
  "Obedience",
  "Loose Lead",
  "Heel Work",
  "Socialisation",
  "Settling",
];

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
