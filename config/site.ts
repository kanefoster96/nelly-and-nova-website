/**
 * Site-wide content & configuration.
 * ----------------------------------
 * Navigation, service areas, contact details and social links live here so
 * copy can be updated without touching component markup. All booking-style
 * CTAs point at "#" for now — wire them to the real booking flow later.
 */

export const BOOKING_HREF = "#book";
export const CONTACT_HREF = "/contact";

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
  { label: "1-1 Training", href: "/one-to-one" },
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

/** "What we do" — tabbed services. */
export type ServiceTab = {
  id: string;
  label: string;
  subtitle: string;
  points: string[];
  cta: string;
  ctaHref: string;
  /** Optional dedicated page for this service. */
  pageHref?: string;
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
      pageHref: "/walk-and-train",
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
      pageHref: "/one-to-one",
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
      { label: "Membership", value: "£60 per day" },
      { label: "One off", value: "£80 per day" },
    ],
    savings: {
      text: "This means full-day members save up to £960 per year based on 48 sessions per year.",
      highlight: "members save up to £960 per year",
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
  updated: "26 Apr 2026",
  intro:
    "This website is owned and operated by Charlotte Smallwood (“we,” “our,” or “us”). These Terms set forth the conditions under which you may use our website and the services we provide. By accessing or using this website, you confirm that you have read, understood, and agree to be bound by these Terms.",
  sections: [
    {
      heading: "1. Services and Products",
      blocks: [
        { p: "This website offers visitors the ability to purchase dog accessories such as collars and leads, and to book professional dog training services including Walk & Train, Full Day Training, and Puppy Training." },
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
          "We reserve the right to cancel or reschedule sessions due to illness, extreme weather, or other safety concerns. In such cases, an alternative session will be arranged.",
          "We are entitled to 4 weeks holidays without refunding memberships due to their discounted rate. Holidays can be found [[here|/holidays]] if you'd like to check our unavailable dates.",
        ] },
      ],
    },
    {
      heading: "4. Right to Refuse or Cancel Services",
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
      heading: "5. Owner Responsibilities",
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
      heading: "6. Use of Photos and Videos",
      blocks: [
        { p: "During training sessions, we may capture photos and videos of your dog for progress tracking, updates, and marketing purposes. These may be shared on our website and social media channels." },
        { p: "By booking our training services, you agree that we may use these materials for promotional purposes unless you request otherwise in writing before your session. We always ensure all media is respectful and focused on showcasing your dog’s training journey." },
      ],
    },
    {
      heading: "7. Product Sales",
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
      heading: "8. Liability Disclaimer",
      blocks: [
        { p: "While we take every precaution to ensure safe and effective training, all dogs behave differently and results may vary. We cannot guarantee specific outcomes." },
        { p: "To the maximum extent permitted by law, we are not liable for any indirect, incidental, or consequential damages, including but not limited to injury, loss, or damage arising from the use of our services or products." },
        { p: "You agree to indemnify and hold Charlotte Smallwood harmless from any claims, losses, or expenses resulting from your use of our services or website." },
      ],
    },
    {
      heading: "9. Changes to Services",
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
      heading: "10. Communication",
      blocks: [
        { p: "By using our services, you consent to receive booking confirmations, progress updates, and relevant communications about your sessions." },
        { p: "You may also receive occasional promotional emails or updates, which you can opt out of at any time by contacting us directly." },
      ],
    },
    {
      heading: "11. Governing Law",
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
      "Our 1-1 training sessions are an hour long, designed to give you and your dog personalised support tailored specifically to your goals. Whether you're looking to improve heel work, recall, and engagement, or need help with specific challenges within obedience, each session is adapted to suit both you and your dog's individual needs.",
      "As part of our approach, we also take a look at your dog's lifestyle. This includes reviewing their day-to-day routine, discussing diet, and considering any potential health factors that could be contributing to unwanted behaviours. This allows us to address the root cause, not just the symptoms.",
      "Sessions are priced at £90 and can take place at a location of your choice, provided it is within our travelling radius. This allows training to happen in an environment where you feel most comfortable and where your dog can learn effectively.",
      "Following your session, you will receive a detailed report outlining everything covered, along with clear guidance on how to continue progressing at home. To ensure ongoing support, you'll also have one month of access to your trainer via WhatsApp. During this time, you can send videos, ask questions, and receive personalised feedback to help you stay on track and achieve lasting results.",
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
      "After your in person 1 to 1 session, you'll receive a clear recap of everything we covered so you don't have to rely on memory or guesswork. We break down each exercise step by step, explain why we used it, and show you exactly how to practise it at home.",
      "You'll get simple, structured instructions for things like handling, timing, rewards, and corrections, so you know exactly what to do and when to do it. This turns the session into something you can repeat confidently on your own, rather than a one off lesson.",
      "The goal is that you leave not just with a better behaved dog on the day, but with the understanding and tools to continue improving long after the session ends.",
    ],
  },
  consultation: {
    eyebrow: "Our Trainers",
    titleLines: ["Free Consultation."],
    paragraphs: [
      "Before your 1-1 session, we offer a free consultation where we chat with you on WhatsApp to understand your dog and what you want to achieve. It is a relaxed, light conversation where you can tell us about any struggles, triggers, or how your dog is around people and different situations.",
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
  email: "charlotte@nellyandnova.co.uk",
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
