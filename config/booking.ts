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

  services: [
    {
      value: "walk-train",
      label: "Walk & Train",
      desc: "Full-day training",
      icon: "paw",
      bookingTypes: [
        { value: "weekly", label: "Weekly Membership", desc: "Same day every week", base: 60, unit: "week" },
        { value: "one-off", label: "One Off", desc: "A single day, no membership", base: 80, unit: "day" },
      ],
    },
    {
      value: "one-to-one",
      label: "1-1 Training",
      desc: "In-person coaching",
      icon: "handshake",
      bookingTypes: [
        { value: "session", label: "1-1 Session", desc: "One hour with you and your dog", base: 90, unit: "session" },
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
