import { media } from "./media";
/**
 * Site-wide content & configuration.
 * ----------------------------------
 * Navigation, service areas, contact details and social links live here so
 * copy can be updated without touching component markup. All booking-style
 * CTAs point at "#" for now — wire them to the real booking flow later.
 */

export const BOOKING_HREF = "/book";
export const CONTACT_HREF = "/contact";

/**
 * What a one-off session costs, in pence: the default amount on a trainer's
 * "Charge" button (app/api/sessions/charge) and the price an owner sees when
 * booking one. A Full Day is £60 with a Full Day membership, else £85. A 1-1
 * is £90 with any membership (Full Day, 1-1 or Online), else £120. A
 * membership is a current place (placements.service) and a Direct Debit:
 * nn_has_membership(account, kind). Mirrored in mobile/src/lib/config.ts and
 * nn_session_price() in the database. Worked out by defaultSessionPrice() in
 * lib/sessions/prices.ts.
 */
export const sessionPrices = { fullDay: 8500, fullDayMember: 6000, oneToOne: 12000, oneToOneMember: 9000 } as const;

/**
 * Online Training's weekly fee, in pence. Kept apart from sessionPrices
 * (which drives the trainers' Charge button) because it isn't a session.
 */
export const onlineTrainingWeekly = 2500;

/** Pence → "£60" (or "£60.50" when there are pennies). For the website's copy. */
export function pounds(pence: number): string {
  return `£${pence % 100 === 0 ? pence / 100 : (pence / 100).toFixed(2)}`;
}

/** The price strings the copy uses, all worked out from the numbers above. */
export const priceText = {
  fullDay: pounds(sessionPrices.fullDay),
  fullDayMember: pounds(sessionPrices.fullDayMember),
  oneToOne: pounds(sessionPrices.oneToOne),
  oneToOneMember: pounds(sessionPrices.oneToOneMember),
  /** What we refund when someone joins a 1-1 membership after their first 1-1. */
  oneToOneJoinRefund: pounds(sessionPrices.oneToOne - sessionPrices.oneToOneMember),
  online: pounds(onlineTrainingWeekly),
};

/** Days and places for the in-person services (as the copy describes them). */
export const schedule = {
  days: "Monday to Thursday",
  fullDayDogsPerDay: 5,
  // A word joiner after the dash keeps "1–2pm" from breaking across lines.
  oneToOneSlots: ["12–\u20601pm", "1–\u20602pm"],
} as const;

/**
 * When Full Day Training dogs are collected and brought home (as "How it
 * works" says). Used by the evening-before reminder (lib/reminders/evening.ts).
 */
export const fullDayTimes = { collect: "between 7:30 and 9:00am", home: "between 4:00 and 5:30pm" } as const;

/** Homepage hero words (the photo and badges live in components/Hero.tsx). */
export const hero = {
  heading: "Happy. Healthy. Dogs.",
  subline: "Real-world dog training through engagement and motivation. Full days, 1-1 sessions or online: choose what suits you.",
  cta: "Find the right training",
};

/**
 * Where the app is installed from: the /app page (the link and QR code a
 * trainer shares at the meet & greet, from the app's onboarding page).
 * Fill in `appStoreUrl` once the app is on the App Store: iPhones opening
 * /app then go straight there. Until then the page explains TestFlight,
 * using `testFlightUrl` (TestFlight → the build → Public Link) when it's set.
 */
export const appLinks = {
  /** e.g. "https://apps.apple.com/gb/app/nelly-nova/id0000000000". Empty until it's live. */
  appStoreUrl: "",
  /** e.g. "https://testflight.apple.com/join/AbCdEfGh". Empty until there's a public link. */
  testFlightUrl: "",
  /** Apple's own TestFlight app. */
  testFlightAppUrl: "https://apps.apple.com/gb/app/testflight/id899247664",
} as const;

/** "We understand" pain points. `icon` maps to painIcons in components/ui/Icons.tsx. */
export type PainPoint = {
  icon: "paw" | "help" | "cross";
  /** Small spaced-out label above the title on the card. */
  eyebrow: string;
  title: string;
  body: string;
  /** Card photo — see media.understand. */
  image: string;
};

export const understand = {
  heading: "We understand.",
  points: [
    {
      icon: "paw",
      eyebrow: "Walks",
      image: media.understand.walks,
      title: "Walks aren't enjoyable.",
      body: "You get anxious or stressed taking your dog out, thinking about the challenge.",
    },
    {
      icon: "help",
      eyebrow: "Training",
      image: media.understand.training,
      title: "Nothing seems to work.",
      body: "You've got a cupboard full of different leads you thought might give you more control, but nothing is changing.",
    },
    {
      icon: "cross",
      eyebrow: "Advice",
      image: media.understand.advice,
      title: "You're stuck.",
      body: "You've heard conflicting advice, and now you're stuck in a loop.",
    },
  ] as PainPoint[],
};

export type NavLink = { label: string; href: string };

export const navLinks: NavLink[] = [
  { label: "Full Day Training", href: "/full-day-training" },
  { label: "1-1 Training", href: "/one-to-one" },
  { label: "Online Training", href: "/online-training" },
  { label: "Contact", href: "/contact" },
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

/** "Three ways we can help": the three services, as equal choices. */
export type ServiceTab = {
  id: string;
  label: string;
  /** Small spaced-out label above the title on the photo. */
  subtitle: string;
  /** A line or two on the photo. */
  description: string;
  /** Card photo. */
  image: string;
  /** Who it suits. */
  bestFor: string;
  /** How much time it asks of the owner. */
  time: string;
  /** What you get: 3–4 short points. */
  points: string[];
  /** The headline price, e.g. { amount: "£60", unit: "a week", note: "as a member, or £85 one-off" }. */
  price: { amount: string; unit: string; note: string };
  cta: string;
  /** The service's own page. */
  pageHref: string;
};

const days = schedule.days;

export const services = {
  eyebrow: "Our Training",
  heading: "Three ways we can help.",
  lead: "Every dog and every owner is different, so there's more than one way to get there. Choose the one that suits you best.",
  tabs: [
    {
      id: "walk-train",
      label: "Full Day Training",
      subtitle: "We train, you learn as you go",
      description: "We collect your dog, train them out in the real world all day and bring them home.",
      image: media.walkTrain.hero,
      bestFor: "Busy owners who'd like us to do the groundwork, and dogs who need real-world practice around other dogs, people and places.",
      time: "Very little. A 5-minute handover at drop-off, then short homework until the next session.",
      points: [
        "Collection from home and a full day of real-world training",
        "A 5-minute handover at every drop-off explaining your homework",
        "“On our way” updates, photos from the day and a report card in the app",
        `${days}, with only ${schedule.fullDayDogsPerDay} dogs a day`,
      ],
      price: { amount: priceText.fullDayMember, unit: "a week", note: `as a member, or ${priceText.fullDay} for a one-off day` },
      cta: "Explore Full Day Training",
      pageHref: "/full-day-training",
    },
    {
      id: "one-to-one",
      label: "1-1 Training",
      subtitle: "One focused, hands-on hour",
      description: "We find the main issues, explain the solutions and change how you handle your dog, so you see results in the hour.",
      image: media.oneToOne.hero,
      bestFor: "Owners who want to learn hands-on and get to the bottom of a specific problem quickly.",
      time: "One hour with us, then practising what we covered. Weekly or every other week if you'd like to keep going.",
      points: [
        "An hour of hands-on training with you and your dog",
        "We pinpoint the main issues and show you how to fix them",
        "A written report and review of the session in the app",
        `${days}, ${schedule.oneToOneSlots.join(" or ")}`,
      ],
      price: { amount: priceText.oneToOne, unit: "a session", note: `or ${priceText.oneToOneMember} for members` },
      cta: "Explore 1-1 Training",
      pageHref: "/one-to-one",
    },
    {
      id: "online-training",
      label: "Online Training",
      subtitle: "Expert guidance, at your pace",
      description: "Custom homework from our trainers every week, an end-of-week review, and a reply to every message within 12 hours.",
      image: media.oneToOne.consultation,
      bestFor: "Owners who are happy to practise at home and want expert guidance that fits around their week, wherever they live.",
      time: "Low. Short homework when it suits you, and an optional quick check-in at the end of the week.",
      points: [
        "Custom weekly homework written by our trainers, never automated",
        "An optional weekly check-in, with videos only if you want to",
        "An end-of-week review and your next steps",
        "Message us any time, with a reply guaranteed within 12 hours",
      ],
      price: { amount: priceText.online, unit: "a week", note: "Cancel any time, no limit on places" },
      cta: "Explore Online Training",
      pageHref: "/online-training",
    },
  ] as ServiceTab[],
  /** Side-by-side comparison (a stacked list on phones). One value per service, in `tabs` order. */
  compare: {
    heading: "At a glance.",
    rows: [
      { label: "Price", values: [`${priceText.fullDay} a day`, `${priceText.oneToOne} a session`, `${priceText.online} a week`] },
      { label: "Members", values: [`${priceText.fullDayMember} a week`, `${priceText.oneToOneMember} a session`, `${priceText.online} a week`] },
      { label: "Who trains", values: ["We do, then show you how", "You do, with us beside you", "You do, guided by us"] },
      { label: "Time from you", values: ["A 5-minute handover and homework", "One hour, then practice", "Homework at your own pace"] },
      { label: "When", values: [`${days}`, `${days}, afternoons`, "Whenever suits you"] },
      { label: "Starts with", values: ["A free meet & greet", "Booking a 1-1 slot", "A quick request form"] },
    ],
  },
  membership: `You can join any of the three as a member. Members pay ${priceText.fullDayMember} for a Full Day and ${priceText.oneToOneMember} for a 1-1.`,
  cta: "Find the right training",
  ctaHref: BOOKING_HREF,
  areaCta: "Check if we cover your area",
  /** The request form checks the postcode. */
  areaHref: BOOKING_HREF,
};

/**
 * Google reviews carousel.
 * ------------------------
 * Live reviews come from Google (lib/reviews/google.ts) once
 * GOOGLE_PLACES_API_KEY is set. Until then,
 * or if Google can't be reached, the `items` below are shown instead.
 * "Leave us a review" goes to /review, which forwards to Google's review box.
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
  items: [
    {
      author: "Sarah M.",
      rating: 5,
      date: "8 Sep 2025",
      avatar: "/placeholders/avatar-1.svg",
      text: "Our 6 month old bull lurcher has weekly full day training sessions with Charlotte and she absolutely loves them. So patient and understanding, and we have seen so much progress over the last couple of months. Couldn't recommend them more.",
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
      text: "Loose lead walking felt impossible before we started. After a few weeks of Full Day Training our dog is calm and focused on walks. The report cards make it easy to keep it up at home.",
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

/** Full Day Training page content. */
export const walkTrainPage = {
  intro: {
    eyebrow: "Real World Dog Training",
    titleLines: ["Full Day Training."],
    paragraphs: [
      "Our Full Day Training sessions give dogs the time and structure to build lasting skills in real-world environments. Training takes place throughout the day in different outdoor settings, helping dogs stay calm, confident, and focused no matter what's happening around them.",
      "Your dog will take part in multiple short training sessions mixed with rest breaks, social exposure, and training around other dogs. We focus on key obedience skills such as loose lead walking, recall, and engagement, while also teaching dogs to settle and relax in public spaces. We install the behaviours, so you're not starting from scratch.",
      `We collect your dog ${fullDayTimes.collect} and bring them home ${fullDayTimes.home}. Every drop-off includes a 5-minute handover, where we explain what your dog worked on and the homework for the week. You learn how to train your dog as you go, practising the homework until the next session.`,
      `Full Day Training runs ${schedule.days}, and we take only ${schedule.fullDayDogsPerDay} dogs a day, so places are limited. It's ${priceText.fullDayMember} a week as a member with a regular weekly place, or ${priceText.fullDay} for a one-off day.`,
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
      "Our report cards are designed to give you complete clarity and confidence in your dog's training. After each session, you'll find a detailed breakdown in the Nelly & Nova app of what your dog worked on, how they performed, and exactly how you can continue that progress at home.",
      "We don't just tell you what happened, we show you how to apply it. The 5-minute handover at drop-off walks you through it, and the simple, structured homework in the app means you can follow it step by step. This keeps training consistent between sessions, helps your dog improve faster, and makes sure you understand how to communicate clearly with them.",
      "The app keeps you close to the day too, with “On our way” updates, photos from the day, your report cards and homework, and chat with our trainers.",
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

/** Privacy Policy page. Same block structure as the Terms page. */
export const privacy = {
  heading: "Privacy Policy.",
  updated: "26 Apr 2026",
  intro:
    "This Privacy Policy explains how Nelly & Nova collects, uses, and protects personal information provided by visitors, customers, and training clients. By using our website or services, you agree to the collection and use of information in accordance with this policy.",
  sections: [
    {
      heading: "What Type of Information We Collect",
      blocks: [
        { p: "We receive, collect, and store any information you enter on our website or provide in other ways. This may include:" },
        { ul: [
          "Personal details such as your name, address, email address, and contact number.",
          "Information about your dog, including name, age, breed, behaviour history, and health information — collected only to help us tailor training sessions to your dog’s individual needs.",
          "Information related to your bookings, purchases, or payment details (including credit or debit card information, processed securely via our payment provider).",
          "Internet Protocol (IP) address, device information, and browsing activity for website analytics.",
          "Communications, messages, feedback, or reviews you provide.",
        ] },
      ],
    },
    {
      heading: "How We Collect Information",
      blocks: [
        { p: "We collect information when you:" },
        { ul: [
          "Complete a booking or purchase through our website.",
          "Fill out a contact form, questionnaire, or sign-up form.",
          "Provide information directly through messages, email, or in person.",
        ] },
        { p: "Your personal information is used only for the purposes outlined below." },
      ],
    },
    {
      heading: "Why We Collect Personal Information",
      blocks: [
        { p: "We collect personal and dog-related information to:" },
        { ul: [
          "Provide, manage, and improve our dog training services.",
          "Understand your dog’s background, behaviour, and needs to tailor training sessions effectively.",
          "Communicate with you regarding bookings, reports, updates, and account information.",
          "Provide customer support and respond to enquiries.",
          "Send important service updates or promotional messages (you can opt out at any time).",
          "Comply with UK laws and regulations, including record keeping and tax purposes.",
        ] },
      ],
    },
    {
      heading: "How We Store, Use, and Protect Your Information",
      blocks: [
        { p: "Our website is hosted on a secure platform that provides the infrastructure to deliver our products and services. Your data may be stored in secure databases and applications on servers protected by firewalls." },
        { p: "All payment gateways we use comply with PCI-DSS standards, ensuring the secure handling of payment details." },
        { p: "Personal and dog-related data collected for training purposes is used only by Nelly & Nova and is never shared with third parties without your consent, unless required by law." },
      ],
    },
    {
      heading: "How We Communicate With You",
      blocks: [
        { p: "We may contact you to:" },
        { ul: [
          "Confirm or update bookings and payments.",
          "Provide training reports, homework, or progress updates.",
          "Resolve issues, request feedback, or share important service information.",
          "Send occasional promotional offers or updates.",
        ] },
        { p: "You may be contacted via email, phone, text, or post, depending on your preferred method of communication." },
      ],
    },
    {
      heading: "Cookies and Tracking Tools",
      blocks: [
        { p: "We only use essential cookies to operate our website effectively." },
        { p: "You can control or delete cookies through your browser settings at any time:" },
        { ul: [
          "[[Cookie settings in Chrome|https://support.google.com/chrome/answer/95647]]",
          "[[Cookie settings in Safari|https://support.apple.com/en-gb/guide/safari/sfri11471/mac]]",
          "[[Cookie settings in Firefox|https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer]]",
        ] },
        { p: "To opt out of Google Analytics tracking across all websites, visit: [[tools.google.com/dlpage/gaoptout|https://tools.google.com/dlpage/gaoptout]]" },
      ],
    },
    {
      heading: "How to Withdraw Consent",
      blocks: [
        { p: "If you no longer want us to process your data, or if you would like to access, correct, or delete any personal information we hold, please contact us via our contact details or email us directly." },
        { p: "We will respond within a reasonable timeframe and comply with all applicable data protection laws." },
      ],
    },
    {
      heading: "Privacy Policy Updates",
      blocks: [
        { p: "We reserve the right to modify this policy at any time. Updates take effect as soon as they are posted on this page." },
        { p: "Any major changes will be clearly noted so you understand what information we collect and how we use it." },
      ],
    },
    {
      heading: "Contact Information",
      blocks: [
        { p: "If you have questions, requests, or concerns regarding this policy or your personal data, please contact:" },
        { p: "Nelly & Nova" },
        { p: "Email: [[charlotte@nellyandnova.co.uk|mailto:charlotte@nellyandnova.co.uk]]" },
        { p: "Website: [[nellyandnova.co.uk|https://www.nellyandnova.co.uk]]" },
      ],
    },
  ] as { heading: string; blocks: TermsBlock[] }[],
};

/** Cookie Policy page. Same block structure as the Terms page. */
export const cookies = {
  heading: "Cookie Policy.",
  updated: "27 Apr 2026",
  intro:
    "This Cookie Policy explains how Charlotte Smallwood (“we,” “our,” or “us”) uses cookies and similar technologies on this website. It should be read alongside our [[Terms & Conditions|/terms]]. By using our website, you agree to our use of cookies as described below, except where your consent is required and not given.",
  sections: [
    {
      heading: "1. What Are Cookies",
      blocks: [
        { p: "Cookies are small text files placed on your device when you visit a website. They are widely used to make websites work, to improve your experience, and to provide information to the site owner." },
        { p: "Similar technologies such as local storage and pixels may also be used. In this policy, we refer to all of these as “cookies”." },
      ],
    },
    {
      heading: "2. How We Use Cookies",
      blocks: [
        { p: "We use cookies to keep the website working correctly, to remember your preferences, and to understand how the site is used so we can improve it. We may also use them to support bookings and payments." },
      ],
    },
    {
      heading: "3. Types of Cookies We Use",
      blocks: [
        { ul: [
          "Essential cookies — required for the website and core features such as bookings and checkout to function. These cannot be switched off.",
          "Functional cookies — remember your choices and preferences to give you a better experience.",
          "Analytics cookies — help us understand how visitors use the site so we can improve it. These are only set with your consent.",
          "Marketing cookies — used to measure the effectiveness of our advertising and social content. These are only set with your consent.",
        ] },
      ],
    },
    {
      heading: "4. Third-Party Cookies",
      blocks: [
        { p: "Some cookies are set by third-party services we use, such as our payment and booking providers, embedded content, reviews, and social media platforms. These providers set their own cookies, which are governed by their own privacy and cookie policies." },
      ],
    },
    {
      heading: "5. Managing Your Cookies",
      blocks: [
        { p: "You can control and delete cookies through your browser settings at any time. Most browsers let you refuse or remove cookies, though blocking essential cookies may affect how the website works." },
        { p: "Where required, we will ask for your consent before setting non-essential cookies, and you can change your choice at any time by contacting us or updating your browser settings." },
      ],
    },
    {
      heading: "6. Changes to This Policy",
      blocks: [
        { p: "We may update this Cookie Policy from time to time. Any changes will be posted on this page, and continued use of our website indicates acceptance of the revised policy." },
      ],
    },
    {
      heading: "7. Contact Us",
      blocks: [
        { p: "If you have any questions about how we use cookies, please contact us and we will be happy to help." },
      ],
    },
  ] as { heading: string; blocks: TermsBlock[] }[],
};

/** What a Full Day member saves in a year of 48 sessions, e.g. "£1,200". */
const fullDayYearlySaving = `£${(((sessionPrices.fullDay - sessionPrices.fullDayMember) * 48) / 100).toLocaleString("en-GB")}`;

/** Holidays / planned closures page. Dates are inclusive ISO (yyyy-mm-dd). */
export const holidays = {
  heading: "Holidays.",
  updated: "27 Apr 2026",
  intro:
    "We run dog training year round and may close for up to four weeks per calendar year for holidays or unavoidable reasons. Planned closures will be listed here with at least 30 days notice where possible. If we need to close unexpectedly, we will inform you as soon as possible. All closures count towards the four week annual allowance.",
  value: {
    heading: "Membership Value.",
    lead: "Our memberships are designed to reward commitment. Even with our four-week annual holiday allowance included, members make substantial savings while securing a guaranteed weekly space.",
    pricingHeading: "Full Day Sessions",
    pricing: [
      { label: "Membership", value: `${priceText.fullDayMember} per day` },
      { label: "One off", value: `${priceText.fullDay} per day` },
    ],
    // (one-off − member price) × 48 sessions a year (52 weeks less the four holiday weeks).
    savings: {
      text: `This means full-day members save up to ${fullDayYearlySaving} per year based on 48 sessions per year.`,
      highlight: `members save up to ${fullDayYearlySaving} per year`,
    },
    paragraphs: [
      "Memberships secure ongoing professional training support and a reserved place in our weekly schedule. Even during closure periods, members continue to receive support via chat and email for guidance, troubleshooting, and help with at home training. Members also receive discounts and offers for extra sessions with up to 50% off!",
      "Because your place is guaranteed year round, sessions are not refunded, credited, or rescheduled during closure dates.",
      "We encourage all clients to review the listed dates and take them into account when joining us.",
    ],
  },
  scheduled: {
    heading: "Scheduled Holidays.",
    year: "2026",
    periods: [
      { start: "2026-03-02", end: "2026-03-09" },
      { start: "2026-06-01", end: "2026-06-04" },
    ],
  },
};

/** Terms & Conditions page. Blocks render in order: `{ p }` or `{ ul }`. */
export type TermsBlock = { p: string } | { ul: string[] };

export const terms = {
  heading: "Terms & Conditions.",
  updated: "20 Nov 2026",
  intro:
    "This website is owned and operated by Charlotte Smallwood (“we,” “our,” or “us”). These Terms set forth the conditions under which you may use our website and the services we provide. By accessing or using this website, you confirm that you have read, understood, and agree to be bound by these Terms.",
  sections: [
    {
      heading: "1. Services and Products",
      blocks: [
        { p: "This website offers visitors the ability to purchase dog accessories such as collars and leads, and to book professional dog training services including Full Day Training, 1-1 Training, and Online Training." },
        { p: "By completing a booking or purchase, you agree that:" },
        { ul: [
          "You are responsible for reading all product or service details before placing an order or making a booking.",
          "You enter into a legally binding agreement when you confirm your purchase or booking through our checkout or payment process.",
        ] },
      ],
    },
    {
      heading: "2. Fees and Payments",
      blocks: [
        { p: "Prices for our products and training services are listed on our website. We reserve the right to adjust prices at any time and to correct any errors that may occur." },
        { p: "Training fees are payable weekly, unless otherwise agreed in writing. Payments are due in advance of your scheduled session to confirm your booking. For recurring weekly sessions, payment will be due on an agreed set day each week." },
      ],
    },
    {
      heading: "3. Cancellations and Refunds",
      blocks: [
        { p: "We understand that plans may change, but to ensure fairness and scheduling availability for all clients:" },
        { ul: [
          "Cancellations made with less than 48 hours’ notice may result in the full session fee being charged.",
          "Refunds or reschedules will be offered at our discretion, depending on notice given and trainer availability.",
          "Sessions and weeks that have already started are not refunded.",
          "We reserve the right to cancel or reschedule sessions due to illness, extreme weather, or other safety concerns. In such cases, an alternative session will be arranged.",
          "We are entitled to 4 weeks holidays without refunding memberships due to their discounted rate. Holidays can be found [[here|/holidays]] if you'd like to check our unavailable dates.",
        ] },
      ],
    },
    {
      heading: "4. Memberships and Member Prices",
      blocks: [
        { p: "You can join any of our training services as a member. Members pay the following member prices:" },
        { ul: [
          `Full Day Training: ${priceText.fullDayMember} per day, with a regular weekly place.`,
          `1-1 Training: ${priceText.oneToOneMember} per session.`,
        ] },
        { p: `Without a membership, a one-off Full Day is ${priceText.fullDay} and a 1-1 session is ${priceText.oneToOne}.` },
      ],
    },
    {
      heading: "5. 1-1 Memberships",
      blocks: [
        { p: `1-1 Training can be taken as a membership, with a regular session every week or every other week, at ${priceText.oneToOneMember} per session.` },
        { p: `If you join a 1-1 membership after your first 1-1 session, we will refund the ${priceText.oneToOneJoinRefund} difference between the full price and the member price for that session. All of your future sessions are then charged at ${priceText.oneToOneMember}.` },
      ],
    },
    {
      heading: "6. Online Training",
      blocks: [
        { p: `Online Training is charged at ${priceText.online} per week.` },
        { ul: [
          "You can message us at any time through the Nelly & Nova app, and we guarantee a reply within 12 hours.",
          "You can cancel at any time.",
          "Fees are not refunded for a week that has already started, or for any week where your homework has already been sent.",
        ] },
      ],
    },
    {
      heading: "7. Right to Refuse or Cancel Services",
      blocks: [
        { p: "We reserve the right to refuse or cancel services for any reason, including but not limited to:" },
        { ul: [
          "Aggressive or unsafe behaviour from a dog or owner.",
          "Unsafe environments or conditions that may pose a risk.",
          "Repeated cancellations, late payments, or failure to comply with our training guidance.",
        ] },
        { p: "If ongoing services are cancelled by us, we will provide notice where possible and explain the reason for termination." },
      ],
    },
    {
      heading: "8. Owner Responsibilities",
      blocks: [
        { p: "When using our training services, you agree to:" },
        { ul: [
          "Provide accurate information about your dog, including medical and behavioural history.",
          "Ensure your dog is appropriately equipped with safe, suitable training gear such as a lead, harness, or collar.",
          "Follow training guidance and complete any homework provided to support consistent progress.",
        ] },
        { p: "We are not responsible for incidents that occur outside of our sessions or as a result of inconsistent follow-through on training guidance." },
      ],
    },
    {
      heading: "9. Use of Photos and Videos",
      blocks: [
        { p: "During training sessions, we may capture photos and videos of your dog for progress tracking, updates, and marketing purposes. These may be shared on our website and social media channels." },
        { p: "By booking our training services, you agree that we may use these materials for promotional purposes unless you request otherwise in writing before your session. We always ensure all media is respectful and focused on showcasing your dog’s training journey." },
      ],
    },
    {
      heading: "10. Product Sales",
      blocks: [
        { p: "All products are sold subject to availability." },
        { ul: [
          "We make every effort to ensure accurate descriptions and images, but slight variations may occur.",
          "If a product is defective or damaged, please contact us within 14 days of receiving it for a replacement or refund.",
          "Shipping times and rates are displayed at checkout. We are not responsible for courier delays once the item has been dispatched.",
        ] },
      ],
    },
    {
      heading: "11. Liability Disclaimer",
      blocks: [
        { p: "While we take every precaution to ensure safe and effective training, all dogs behave differently and results may vary. We cannot guarantee specific outcomes." },
        { p: "To the maximum extent permitted by law, we are not liable for any indirect, incidental, or consequential damages, including but not limited to injury, loss, or damage arising from the use of our services or products." },
        { p: "You agree to indemnify and hold Charlotte Smallwood harmless from any claims, losses, or expenses resulting from your use of our services or website." },
      ],
    },
    {
      heading: "12. Changes to Services",
      blocks: [
        { p: "We may, without prior notice:" },
        { ul: [
          "Modify or discontinue parts of our services or products.",
          "Adjust session structures, timings, or pricing.",
          "Update these Terms as necessary.",
        ] },
        { p: "Any significant changes will be posted on this page. Continued use of our website or services after updates indicates acceptance of the revised Terms." },
      ],
    },
    {
      heading: "13. Communication",
      blocks: [
        { p: "By using our services, you consent to receive booking confirmations, progress updates, and relevant communications about your sessions." },
        { p: "You may also receive occasional promotional emails or updates, which you can opt out of at any time by contacting us directly." },
      ],
    },
    {
      heading: "14. Governing Law",
      blocks: [
        { p: "These Terms are governed by the laws of England. Any disputes shall be handled exclusively by a court of competent jurisdiction within England." },
      ],
    },
  ] as { heading: string; blocks: TermsBlock[] }[],
};

/** 1-1 Training page content. */
export const oneToOnePage = {
  intro: {
    eyebrow: "Learn How to Train",
    titleLines: ["1-1 Training."],
    paragraphs: [
      "Our 1-1 sessions are a focused, high-value hour with you and your dog. We find the main issues, explain the solutions, and work hands-on to change how you handle your dog, so you see results in the hour and keep getting them afterwards. Whether you're looking to improve heel work, recall, and engagement, or need help with specific challenges within obedience, each session is adapted to suit both you and your dog.",
      "As part of our approach, we also take a look at your dog's lifestyle. This includes reviewing their day-to-day routine, discussing diet, and considering any potential health factors that could be contributing to unwanted behaviours. This allows us to address the root cause, not just the symptoms.",
      `Sessions run ${schedule.days}, in two afternoon slots: ${schedule.oneToOneSlots.join(" and ")}. They're ${priceText.oneToOne}, or ${priceText.oneToOneMember} for members, and can take place at a location of your choice, provided it is within our travelling radius. This allows training to happen in an environment where you feel most comfortable and where your dog can learn effectively.`,
      `1-1s can be a membership too, with a regular session every week or every other week at ${priceText.oneToOneMember} a session. If you decide to join after your first 1-1, we'll refund the ${priceText.oneToOneJoinRefund} difference for that day, and all your future sessions are ${priceText.oneToOneMember}.`,
      "Following your session, you'll receive a written report and review in the Nelly & Nova app, outlining everything we covered along with clear guidance on how to keep progressing at home. To ensure ongoing support, you'll also have one month of chat with your trainer in the app, where you can send videos, ask questions, and receive personalised feedback.",
    ],
  },
  understand: {
    eyebrow: "In-person Training",
    titleLines: ["Understand.", "Your.", "Dog."],
    paragraphs: [
      "Our 1-1 sessions are designed to give you complete clarity and control when working with your dog. Rather than just training the dog, we focus on teaching you exactly how to communicate effectively, so you understand why behaviours are happening and how to improve them. We break everything down into clear, practical steps, covering key foundations like engagement, lead handling, timing, and reward placement.",
    ],
  },
  report: {
    eyebrow: "Report Card",
    titleLines: ["Continue.", "Your.", "Training."],
    paragraphs: [
      "After your 1-1 session, you'll receive a written report and review in the app, so everything we covered is down in writing and you don't have to rely on memory or guesswork. We break down each exercise step by step, explain why we used it, and show you exactly how to practise it at home.",
      "You'll get simple, structured instructions for things like handling, timing, rewards, and corrections, so you know exactly what to do and when to do it. This turns the session into something you can repeat confidently on your own, rather than a one off lesson.",
      "The goal is that you leave not just with a better behaved dog on the day, but with the understanding and tools to continue improving long after the session ends.",
    ],
  },
  consultation: {
    eyebrow: "Getting Started",
    titleLines: ["Book a 1-1 Slot."],
    paragraphs: [
      `Anyone can book an open slot online, with no meet & greet needed. Choose a ${schedule.days} afternoon slot, ${schedule.oneToOneSlots.join(" or ")}, and tell us about your dog and what you'd like to achieve.`,
      "Before your session, we'll have a relaxed, free chat with you to understand your dog: any struggles, triggers, or how they are around people and different situations, so we can make the most of your hour.",
    ],
  },
};

/** Online Training page content. */
export const onlineTrainingPage = {
  intro: {
    eyebrow: "Train From Anywhere",
    titleLines: ["Online Training."],
    paragraphs: [
      "Online Training is our low-maintenance option. It starts with you telling us all about your dog, and we find the main things you need help with. Then, every week, our trainers write custom homework just for you and your dog. It's never automated.",
      `It's ${priceText.online} a week, there's no travel involved, there's no limit on places, and it works wherever you live.`,
    ],
  },
  review: {
    eyebrow: "Your Weekly Homework",
    titleLines: ["Custom.", "Weekly.", "Homework."],
    paragraphs: [
      "Each week's homework is written by our trainers for your dog, building on how the last week went. It covers our communication system, lead handling, socialisation and the management skills you'll need, with clear steps showing you exactly what to practise and how.",
      "There's an optional quick check-in form in the app to tell us how the homework and the week went. You're welcome to add videos, but they're never required.",
      "At the end of each week, we review how it went and tell you what's working, what to change and what comes next, so the small things, like timing and reward placement, don't hold you back.",
    ],
  },
  support: {
    eyebrow: "Never Left Alone",
    titleLines: ["Message.", "Us.", "Any Time."],
    paragraphs: [
      "You're never left on your own waiting for the next scheduled call. You can message us 24 hours a day in the Nelly & Nova app, and we guarantee a reply within 12 hours. Had a tricky walk, or not sure what to do next? Just message us.",
      "Everything happens in the app, in one place: your homework, the community feed, and chat with our trainers.",
    ],
  },
  start: {
    eyebrow: "Get Started",
    titleLines: ["Tell Us About Your Dog."],
    paragraphs: [
      `Tell us about your dog and what you'd like to achieve, and we'll get in touch to chat about your goal and get you started. ${priceText.online} a week, cancel any time.`,
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
        `Full Day Training is ${priceText.fullDayMember} a week as a member, with a regular weekly place. One-off days are ${priceText.fullDay}, if you'd like to book in as and when you need it.`,
        `Our 1-1 sessions are an hour of hands-on training with you and your dog, where we find the main issues and change how you handle your dog. These are ${priceText.oneToOne}, or ${priceText.oneToOneMember} for members.`,
        `Online Training is ${priceText.online} a week. Our trainers write custom homework for you each week, review how it went at the end of the week, and you can message us any time in our app.`,
        `You can join any of the three as a member. Members pay ${priceText.fullDayMember} for a Full Day and ${priceText.oneToOneMember} for a 1-1.`,
      ],
    },
    {
      q: "Can 1-1s be regular?",
      a: [
        `Yes. You can book a 1-1 every week or every other week as a member, at ${priceText.oneToOneMember} a session. Sessions run ${schedule.days}, ${schedule.oneToOneSlots.join(" or ")}.`,
        `If you decide to join after your first 1-1, we'll refund the ${priceText.oneToOneJoinRefund} difference for that session, and all your future sessions are ${priceText.oneToOneMember}.`,
      ],
    },
    {
      q: "How quickly do you reply?",
      a: [
        "With Online Training, you can message us any time, day or night, in the Nelly & Nova app, and we guarantee a reply within 12 hours.",
        "If you train with us in person, you can chat with us in the app too, and we'll get back to you as soon as we can.",
      ],
    },
    {
      q: "Can I cancel?",
      a: [
        "Yes, you can cancel any time. Sessions and weeks that have already started aren't refunded. For Online Training, that's because the homework for the week has already been sent.",
        "If you need to cancel or move a booked session, please give us at least 48 hours' notice, or the full session fee may be charged.",
      ],
    },
    {
      q: "What areas do you cover?",
      a: [
        "We started in Tynemouth, but now we're able to travel to surrounding areas such as Cramlington, Backworth and Blyth.",
        "To check if we work in your area, please contact us using the button below and we will be happy to help! Online Training works wherever you live.",
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
        "For Full Day Training, yes, and it's free. Before we can collect your dog for training, they need to be familiar with us. We also like to know how your dog behaves with you, and chat in-person about your struggles and goals for their training.",
        "There are no wrong answers. If you don't care about your dog jumping up but would just like to have them not pull on the lead - that's what we will help you with!",
        "For 1-1 and Online Training, you don't need one. You can book a 1-1 slot or get started with Online Training straight from our request form.",
      ],
    },
    {
      q: "What equipment do I need?",
      a: [
        "We will train your dog in whatever you currently have. As they progress, we will recommend training equipment that we think will benefit them the most. You'll never be forced to purchase more items, but we would advise them if needed.",
      ],
    },
    {
      q: "Do you use training tools?",
      a: [
        "We're balanced trainers, so yes, we do use tools, but we don't rely on them. We teach dogs using rewards and treats, and we make sure every dog is comfortable and fully understands each skill and behaviour.",
        "Tools help a dog understand how to move with the lead and respond to pressure. Once a dog understands what you're asking of them, tools make their training clear and consistent.",
        "We'll always explain why we use a certain tool, and they aren't one size fits all. We just ask every owner to be willing to learn and adjust, just as much as their dog.",
      ],
    },
  ] as Faq[],
};

/** "How it works" steps. `icon` maps to stepIcons in components/ui/Icons.tsx. */
export type Step = { icon: "handshake" | "calendar" | "paw" | "home"; title: string; body: string };

export const howItWorks = {
  /** It's the Full Day Training journey; the eyebrow says so. */
  eyebrow: "Full Day Training",
  heading: "How it works.",
  steps: [
    {
      icon: "handshake",
      title: "Free Meet & Greet",
      body: "We will come out to meet you and your dog for free. Then we can see exactly what your struggles are and tell you how we will help before you pay anything. No commitment if you still need time to think.",
    },
    {
      icon: "calendar",
      title: "Choose your day",
      body: `When you decide to book, choose a regular weekly place as a member (${priceText.fullDayMember} a week) or a one-off day (${priceText.fullDay}). We train ${schedule.days} and take only ${schedule.fullDayDogsPerDay} dogs a day. There's a short waiver to complete, and memberships are paid via GoCardless (Direct Debit), cancel anytime.`,
    },
    {
      icon: "paw",
      title: "Training day",
      body: `We collect your dog ${fullDayTimes.collect}, train them out in the real world all day and bring them home ${fullDayTimes.home}. You'll get “On our way” updates and photos from the day in the app.`,
    },
    {
      icon: "home",
      title: "Handover & homework",
      body: "Every drop-off includes a 5-minute handover explaining what we worked on and your homework, and your report card is waiting in the app. You practise until the next session, and can chat with us in the app any time. When you have the confidence to take over, you can cancel your membership with no cancellation fees or notices.",
    },
  ] as Step[],
};

export const contact = {
  phone: "+44 191 468 3251",
  phoneLabel: "0191 468 3251",
  email: "charlotte@nellyandnova.co.uk",
  /** WhatsApp click-to-chat link — replace the number (international format, no +). */
  whatsapp: "https://wa.me/441914683251",
};

/** Hero trust badges. `icon` maps to benefitIcons in components/ui/Icons.tsx. */
export type Benefit = { label: string; icon: "message" | "close" | "card" | "insured" | "check" };

export const heroBenefits: Benefit[] = [
  { label: "Free Meet & Greet", icon: "check" },
  { label: "Report Cards", icon: "card" },
  { label: "Fully Insured", icon: "insured" },
  { label: "Cancel Anytime", icon: "close" },
  // Last: it gets the centred row of its own, which suits the longest label.
  { label: "Message Us Any Time", icon: "message" },
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
  "Life Skills",
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
    "Dog training through engagement and motivation across Tynemouth, Backworth and the North East. Full Day Training, 1-1 sessions and Online Training.",
  region: "North East England",
  year: 2026,
};
