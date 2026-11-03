/**
 * Booking / meet & greet form configuration.
 * Options, copy and pricing live here so the form and the email stay in sync.
 * Structured to slot into a future chat / notification system without changes.
 */

export type BookingTypeOption = {
  value: string;
  label: string;
  desc: string;
  base: number; // £ for the first dog, per unit
  unit: string; // "week" | "day" | "session"
};

export type ServiceOption = {
  value: string;
  label: string;
  desc: string;
  icon: "paw" | "handshake";
  bookingTypes: BookingTypeOption[];
};

export const booking = {
  /** Discount (£) applied to each additional dog from the same household. */
  secondDogDiscount: 5,

  /** Number of dogs — a drop-down so the estimated price updates live. */
  dogCounts: [
    { value: "1", label: "1 dog" },
    { value: "2", label: "2 dogs" },
    { value: "3", label: "3 dogs" },
  ],

  services: [
    {
      value: "walk-train",
      label: "Full Day Training",
      desc: "We collect, train & drop off",
      icon: "paw",
      bookingTypes: [
        { value: "weekly", label: "Weekly Membership", desc: "Same day every week", base: 60, unit: "week" },
        { value: "one-off", label: "One Off", desc: "A single day, no membership", base: 80, unit: "day" },
      ],
    },
    {
      value: "one-to-one",
      label: "1-1 Training",
      desc: "In-person training",
      icon: "handshake",
      bookingTypes: [
        { value: "session", label: "1-1 Session", desc: "One hour with you and your dog", base: 90, unit: "session" },
      ],
    },
    {
      value: "online-training",
      label: "Online Training",
      desc: "Videos, feedback and 24/7 help",
      icon: "handshake",
      bookingTypes: [
        { value: "weekly", label: "Weekly", desc: "Cancel any time", base: 25, unit: "week" },
      ],
    },
  ] as ServiceOption[],

  findUs: [
    { value: "socials", label: "Socials" },
    { value: "website", label: "Website" },
    { value: "referral", label: "Referral" },
  ],
  genders: [
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
  ],
  yesNo: [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
  ],

  fullDay: { collection: "8:00 – 10:00 am", dropoff: "4:00 – 6:00 pm" },

  copy: {
    intro:
      "Book your free meet & greet. It only takes a couple of minutes — tell us a bit about you, your booking and your dog, and we'll be in touch to arrange a visit.",
    areasIntro: "We currently cover these areas:",
    areasNote:
      "Don't see your area? Just leave your full address / postcode and we'll check for you.",
    dogsNote: "Any additional dogs from the same household are discounted £5.",
    dogIntro:
      "Once we confirm your booking we'll need a few more details (like an emergency contact and health info). For now, we just want to get an idea of your dog's behaviour and personality.",
    toolsNote:
      "At Nelly & Nova, we only recommend tools and methods (including prong or e-collars where appropriate) when we believe they'll make your dog safer and improve their quality of life — and we'll always explain our reasoning before using anything. For training to work, we need you fully on board with following our guidance throughout the process.",
    trustQuestion:
      "Are you happy to trust our training guidance and commit to following our recommendations?",
    meetGreet: [
      "We need to meet you and your dog before we can confirm any services, to make sure we can help.",
      "Visits take 15–30 minutes, and it's the perfect time to hand over house keys etc. if you're booking a membership. We can optionally shadow you on a walk to get a sense of your dog's walking habits too.",
      "Once we've got your form, we'll be in touch to book this in ASAP so we can help get your walks back on track!",
    ],
  },

  placeholders: {
    withDogs: "e.g. Not good with strange dogs.",
    withPeople: "e.g. Friendly but can get too excited.",
    needHelp: "e.g. Chases wildlife. Scared of people in hats.",
    allergies: "e.g. Allergic to chicken.",
    tools: "e.g. A collar and a lead.",
  },
};

export function findService(value: string) {
  return booking.services.find((s) => s.value === value);
}

export function findBookingType(serviceValue: string, bookingValue: string) {
  return findService(serviceValue)?.bookingTypes.find((b) => b.value === bookingValue);
}

/** Live total for the selected service + booking type + number of dogs. */
export function priceFor(
  serviceValue: string,
  bookingValue: string,
  dogs: number
): { total: number; unit: string; base: number } | null {
  const b = findBookingType(serviceValue, bookingValue);
  if (!b || !Number.isFinite(dogs) || dogs < 1) return null;
  const total = b.base + (dogs - 1) * (b.base - booking.secondDogDiscount);
  return { total, unit: b.unit, base: b.base };
}

/* ------------------------------------------------------------------------- */
/* Free meet & greet request (/book)                                          */
/* ------------------------------------------------------------------------- */

export type MeetGreetChoice = { value: string; label: string; desc: string; icon?: "paw" | "handshake" };

export const meetGreet = {
  /** Step 2 — what they're interested in. */
  services: [
    { value: "full-day-training", label: "Full Day Training", desc: "We collect, train all day and drop off — starts with a free meet & greet", icon: "paw" },
    { value: "one-to-one", label: "1-1 Training", desc: "An hour with you and your dog", icon: "handshake" },
    { value: "online-training", label: "Online Training", desc: "We teach you the skills, you message us any time — £25 a week" },
    { value: "not-sure", label: "Not sure yet", desc: "We'll chat and help you choose" },
  ] as MeetGreetChoice[],

  /** Step 3 — what they'd like help with (pick any). "other" asks for a note. */
  help: [
    { value: "lead-pulling", label: "Lead pulling" },
    { value: "lunging-at-dogs", label: "Lunging at dogs" },
    { value: "basic-obedience", label: "Basic obedience" },
    { value: "recall", label: "Recall" },
    { value: "jumping-up", label: "Jumping up" },
    { value: "barking", label: "Barking" },
    { value: "reactive-to-people", label: "Reactive to people" },
    { value: "nervous-anxious", label: "Nervous or anxious" },
    { value: "chasing", label: "Chasing (bikes, cars, wildlife)" },
    { value: "separation", label: "Being left alone" },
    { value: "puppy-training", label: "Puppy training" },
    { value: "other", label: "Other" },
  ],

  /**
   * Step 4 — the postcode check. Outward codes (the first half of a postcode)
   * we travel to, with the area name shown back to them. Anything else can
   * still send the request; it's just flagged for us to check.
   */
  coverage: {
    NE23: "Cramlington",
    NE25: "Whitley Bay & Holywell",
    NE26: "Whitley Bay",
    NE27: "Shiremoor & Backworth",
    NE28: "Wallsend",
    NE29: "North Shields",
    NE30: "Tynemouth, Cullercoats & North Shields",
  } as Record<string, string>,
};

const UK_POSTCODE_RE = /^([A-Z]{1,2}\d[A-Z\d]?) ?(\d[A-Z]{2})$/;

/**
 * Checks a postcode against the areas we cover.
 *  - "invalid": doesn't look like a UK postcode
 *  - "covered": in one of our areas (area = the name to show)
 *  - "outside": a real postcode we don't normally travel to
 * `partial` accepts just the outward code (e.g. "NE30") while they're typing.
 */
export function checkPostcode(raw: string): { status: "invalid" | "covered" | "outside"; outward?: string; area?: string; formatted?: string } {
  const pc = raw.toUpperCase().replace(/\s+/g, " ").trim();
  const full = pc.replace(/\s/g, "").match(/^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/);
  const outward = full ? full[1] : /^[A-Z]{1,2}\d[A-Z\d]?$/.test(pc) ? pc : null;
  if (!outward) return { status: "invalid" };
  const formatted = full ? `${full[1]} ${full[2]}` : outward;
  if (full && !UK_POSTCODE_RE.test(formatted)) return { status: "invalid" };
  const area = meetGreet.coverage[outward];
  return area ? { status: "covered", outward, area, formatted } : { status: "outside", outward, formatted };
}

export function meetGreetServiceLabel(value: string): string {
  return meetGreet.services.find((s) => s.value === value)?.label ?? value;
}

export function meetGreetHelpLabels(values: string[], other?: string): string[] {
  return values.map((v) => (v === "other" && other?.trim() ? `Other: ${other.trim()}` : meetGreet.help.find((h) => h.value === v)?.label ?? v));
}

/**
 * What happens next, by service. Only Full Day Training starts with a free
 * meet & greet (our main offer); 1-1 and Online Training go straight to a
 * chat to get them booked in. Used by the request form's thank-you screen
 * and the confirmation email, so they always agree.
 */
export function requestNextSteps(service: string, dog: string): { kicker: string; body: string } {
  switch (service) {
    case "full-day-training":
      return {
        kicker: "Free meet & greet",
        body: `We'll read through everything you've told us about ${dog}, give you a call or message with a few questions, and book a day that suits you to meet ${dog} — completely free.`,
      };
    case "one-to-one":
      return {
        kicker: "1-1 Training",
        body: `We'll read through everything you've told us about ${dog} and get in touch to chat about what you'd like to work on and book your 1-1 session.`,
      };
    case "online-training":
      return {
        kicker: "Online Training",
        body: `We'll read through everything you've told us about ${dog} and get in touch for a quick, free chat to get you started with Online Training.`,
      };
    default:
      return {
        kicker: "Getting started",
        body: `We'll read through everything you've told us about ${dog} and get in touch to chat about what would suit you both best.`,
      };
  }
}
