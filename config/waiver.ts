/**
 * Final Consent & Waiver content + field options.
 * Edit the clause copy here — the waiver form renders it verbatim.
 */

export type Clause = {
  heading: string;
  lead?: string;
  bullets?: string[];
  note?: string;
  body?: string;
};

export const waiverTitle = "Training Consent & Waiver";

export const waiverClauses: Clause[] = [
  {
    heading: "1. Consent for Services",
    lead: "The Client hereby grants permission for the Trainer/Walker to:",
    bullets: [
      "Take the Dog out for walking and training sessions.",
      "Transport the Dog in a secure crate during travel.",
      "Use the Trainer/Walker’s own training tools and equipment.",
      "Apply the Trainer/Walker’s preferred training methods and techniques.",
      "Socialise the Dog with other animals and people, as deemed appropriate by the Trainer/Walker.",
    ],
  },
  {
    heading: "2. Health and Identification",
    lead: "The Client confirms that:",
    bullets: [
      "The Dog is up-to-date with vaccinations.",
      "The Dog receives regular flea and worm treatments.",
      "The Dog is microchipped and the microchip is registered.",
    ],
  },
  {
    heading: "3. Acknowledgement of Risks",
    lead: "The Client acknowledges and understands that:",
    bullets: [
      "Dog walking and training involve inherent risks, including but not limited to injury, illness, or behavioural issues.",
      "The Trainer/Walker will take all reasonable precautions to ensure the Dog’s safety and well-being.",
      "The Client is responsible for informing the Trainer/Walker of any known medical conditions, allergies, or behavioural concerns.",
      "The Client consents to the Trainer/Walker entering their property without the Client present for the purposes of collecting, dropping off, or caring for the Dog, as agreed in advance.",
    ],
  },
  {
    heading: "4. Waiver of Liability",
    lead: "To the fullest extent permitted by law, the Client agrees to release and hold harmless the Trainer/Walker from any and all claims, damages, or liabilities arising from:",
    bullets: [
      "Injury, illness, or death of the Dog during walking or training sessions.",
      "Damage to property caused by the Dog.",
      "The Dog’s actions while under the Trainer/Walker’s care.",
    ],
    note: "This waiver does not cover incidents resulting from gross negligence or deliberate misconduct by the Trainer/Walker.",
  },
  {
    heading: "5. Emergency Medical Treatment",
    body: "In the event of an emergency where the Client cannot be reached, the Client authorises the Trainer/Walker to seek veterinary care for the Dog. The Client agrees to cover all costs associated with such care.",
  },
  {
    heading: "6. Holidays and Closures",
    body: "We may take up to four weeks per calendar year where dog training services do not operate. This may include planned holidays or unavoidable closures. All closures form part of this allowance and sessions are not refunded, credited, or rescheduled. Planned closures will be displayed in advance where possible.",
  },
  {
    heading: "7. Indemnification",
    body: "The Client agrees to indemnify and hold harmless the Trainer/Walker from any claims, damages, or expenses resulting from the Dog’s actions, including (but not limited to) injury to other animals or people.",
  },
  {
    heading: "8. Governing Law",
    body: "This Agreement shall be governed by and interpreted in accordance with the laws of England and Wales.",
  },
  {
    heading: "9. Entire Agreement",
    body: "This document represents the entire agreement between the parties. Any amendments must be made in writing and signed by both parties.",
  },
];

export const waiverAgreement =
  "I confirm that I have read, understood, and agree to the terms outlined above. I consent to the services provided and acknowledge my responsibilities as the Dog’s owner.";

export const dialCodes = ["+44", "+353", "+1", "+61"];

export const countryOptions = [
  { value: "", label: "Country/Region" },
  { value: "United Kingdom", label: "United Kingdom" },
  { value: "Ireland", label: "Ireland" },
  { value: "Other", label: "Other" },
];

export const genderOptions = [
  { value: "", label: "Select…" },
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Unknown", label: "Unknown" },
];

export const yesNo = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];
