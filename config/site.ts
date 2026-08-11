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

export const navLinks: NavLink[] = [
  { label: "Walk & Train", href: "/walk-and-train" },
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

/**
 * Google reviews carousel.
 * ------------------------
 * `items` below are PLACEHOLDERS. To connect the real feed, fetch the Google
 * Places Details API (fields: reviews) for the business `place_id` and map each
 * returned review to the `Review` shape:
 *   author       ← review.author_name
 *   rating       ← review.rating
 *   text         ← review.text
 *   date         ← review.relative_time_description  (or format review.time)
 *   avatar       ← review.profile_photo_url          (optional; NN monogram if absent)
 * Then pass the mapped array to <Reviews items={...} />. Nothing else changes.
 */
export type Review = {
  author: string;
  rating: number; // 1–5
  text: string;
  date: string;
  avatar?: string;
};

export const googleReviews = {
  heading: "Our reviews.",
  cta: "Leave us a review on",
  /** Replace with your Google "write a review" link (g.page/r/… or Maps URL). */
  reviewUrl: "#",
  items: [
    {
      author: "Sarah M.",
      rating: 5,
      date: "8 Sep 2025",
      avatar: "/placeholders/avatar-1.svg",
      text: "Our 6 month old bull lurcher has weekly walk & train sessions with Charlotte and she absolutely loves them. So patient and understanding, and we have seen so much progress over the last couple of months. Couldn't recommend them more.",
    },
    {
      author: "Rachel T.",
      rating: 5,
      date: "21 Sep 2025",
      text: "We have been using the weekly package for our Nova and it's been great. They really took the time to get to know our puppy. The updates after each session are so reassuring and detailed.",
    },
    {
      author: "James P.",
      rating: 5,
      date: "2 Aug 2025",
      avatar: "/placeholders/avatar-2.svg",
      text: "Loose lead walking felt impossible before we started. After a few weeks of Walk & Train our dog is calm and focused on walks. The report cards make it easy to keep it up at home.",
    },
    {
      author: "Emma W.",
      rating: 5,
      date: "17 Jul 2025",
      avatar: "/placeholders/avatar-3.svg",
      text: "Genuinely life-changing for our rescue. Kind, knowledgeable and always on hand over WhatsApp when we have questions. Our confidence as owners has grown just as much as our dog's.",
    },
  ] as Review[],
};

/** Walk & Train page content. */
export const walkTrainPage = {
  intro: {
    eyebrow: "Real World Dog Training",
    titleLines: ["Walk & Train."],
    paragraphs: [
      "Our Full Day Walk & Train sessions give dogs the time and structure to build lasting skills in real-world environments. Training takes place throughout the day in different outdoor settings, helping dogs stay calm, confident, and focused no matter what's happening around them.",
      "Your dog will take part in multiple short training sessions mixed with rest breaks, social exposure, and training around other dogs. We focus on key obedience skills such as loose lead walking, recall, and engagement, while also teaching dogs to settle and relax in public spaces.",
      "At the end of the day, you'll receive a detailed report on what your dog worked on, how they progressed, and homework to keep their learning consistent at home.",
      "Our goal is to help dogs return home calm, fulfilled, and better prepared for everyday life both on and off the lead.",
    ],
  },
  van: {
    eyebrow: "Our Van",
    titleLines: ["Safe.", "Comfortable.", "Transport."],
    paragraphs: [
      "We collect your dog directly from home and return them after their session. Each dog travels safely in our crash-proof transport crates, fitted with soft mats for comfort and stability during the journey.",
    ],
  },
  report: {
    eyebrow: "Report Card",
    titleLines: ["Continue.", "Your.", "Training."],
    paragraphs: [
      "Our report cards are designed to give you complete clarity and confidence in your dog's training. After each session, you'll receive a detailed breakdown of what your dog worked on, how they performed, and exactly how you can continue that progress at home.",
      "We don't just tell you what happened, we show you how to apply it, with simple, structured homework you can follow step by step. This keeps training consistent between sessions, helps your dog improve faster, and makes sure you understand how to communicate clearly with them.",
      "Over time, these reports build into a clear journey of progress, so you can see exactly how far your dog has come and what to focus on next.",
    ],
  },
  meetGreet: {
    eyebrow: "Our Trainers",
    titleLines: ["Meet & Greet."],
    paragraphs: [
      "We offer a free meet and greet before any commitment to make sure your dog feels comfortable and you feel confident in booking. It also gives us the chance to see how your dog responds, understand their needs, and ensure our training is the right fit for them.",
    ],
  },
};

/** FAQ accordion. Each answer is an array of paragraphs. */
export type Faq = { q: string; a: string[] };

export const faq = {
  heading: "Frequently asked questions.",
  cta: "Ask us a question",
  items: [
    {
      q: "How much is dog training?",
      a: [
        "Our Walk & Train days are £60 per week, if you sign up for a membership with a fixed slot.",
        "We also offer one-off Walk & Train days for £80, if you'd like to book in as and when you need it without a membership.",
        "Our 1-1 sessions are an hour of in-person training, where we work with you and your dog to improve handling skills and address specific issues you're having. These are £90 per hour.",
      ],
    },
    {
      q: "What areas do you cover?",
      a: [
        "We started in Tynemouth, but now we're able to travel to surrounding areas such as Cramlington, Backworth and Blyth.",
        "To check if we work in your area, please contact us using the button below and we will be happy to help!",
      ],
    },
    {
      q: "How long does the training take?",
      a: [
        'Training varies based on your dog and their specific behaviours. Promising results in set time periods requires lots of "punishment" - we believe in supporting dogs through their journey and rewarding their learning at their own pace. We work by telling your dog the answers first, before working on correcting their mistakes.',
        "The homework provided each week is designed to help them progress more quickly, so the more you learn and ask us, the faster your dog will progress. Once you feel like they're ready, you can cancel anytime.",
      ],
    },
    {
      q: "Do I need a meet and greet?",
      a: [
        "Yes. Before we can collect your dog for training, they need to be familiar with us. We also like to know how your dog behaves with you, and chat in-person about your struggles and goals for their training.",
        "There are no wrong answers. If you don't care about your dog jumping up but would just like to have them not pull on the lead - that's what we will help you with!",
      ],
    },
    {
      q: "What equipment do I need?",
      a: [
        "We will train your dog in whatever you currently have. As they progress, we will recommend training equipment that we think will benefit them the most. You'll never be forced to purchase more items, but we would advise them if needed.",
      ],
    },
  ] as Faq[],
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
