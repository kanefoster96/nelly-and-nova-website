/**
 * Map form submissions to inbox requests. Shared by the API routes (to create
 * a request on submit) and by the sample data, so what shows in the inbox
 * matches what customers actually submit.
 */
import type { NewRequest, RequestDetail } from "./types";
import { findService, findBookingType, priceFor } from "@/config/booking";

const clean = (v: unknown) => String(v ?? "").trim();
const orDash = (v: unknown) => clean(v) || "—";

/** Contact form → request. */
export function contactToRequest(d: Record<string, unknown>): NewRequest {
  const name = clean(d.name);
  const message = clean(d.message);
  const details: RequestDetail[] = [
    { label: "Name", value: orDash(d.name) },
    { label: "Email", value: orDash(d.email) },
    { label: "Phone", value: orDash(d.phone) },
    { label: "Message", value: orDash(d.message) },
  ];
  return {
    kind: "contact",
    requesterName: name || "Website visitor",
    email: clean(d.email) || undefined,
    phone: clean(d.phone) || undefined,
    summary: message.length > 90 ? `${message.slice(0, 90)}…` : message || "Contact enquiry",
    details,
  };
}

/** Booking / meet & greet form → request. */
export function bookingToRequest(d: Record<string, unknown>): NewRequest {
  const svc = findService(clean(d.service));
  const bt = findBookingType(clean(d.service), clean(d.bookingType));
  const dogs = parseInt(clean(d.dogs), 10) || 1;
  const price = priceFor(clean(d.service), clean(d.bookingType), dogs);
  const name = `${clean(d.firstName)} ${clean(d.lastName)}`.trim();

  const details: RequestDetail[] = [
    { label: "Name", value: name || "—" },
    { label: "Email", value: orDash(d.email) },
    { label: "Phone", value: orDash(d.phone) },
    { label: "Address", value: orDash(d.address) },
    { label: "Found us via", value: orDash(d.findUs) },
    { label: "Service", value: svc?.label ?? orDash(d.service) },
    { label: "Booking type", value: bt?.label ?? orDash(d.bookingType) },
    { label: "Dogs", value: String(dogs) },
    { label: "Estimated price", value: price ? `£${price.total} per ${price.unit}` : "—" },
    { label: "Dog's name", value: orDash(d.dogName) },
    { label: "Breed", value: orDash(d.breed) },
    { label: "Gender", value: orDash(d.gender) },
    { label: "Age", value: orDash(d.age) },
    { label: "With other dogs", value: orDash(d.withDogs) },
    { label: "With other people", value: orDash(d.withPeople) },
    { label: "Needs help with", value: orDash(d.needHelp) },
    { label: "Allergies", value: orDash(d.allergies) },
    { label: "Lead / tools", value: orDash(d.tools) },
    { label: "Trusts our guidance", value: orDash(d.trust) },
  ];

  return {
    kind: "booking",
    requesterName: name || "Website visitor",
    email: clean(d.email) || undefined,
    phone: clean(d.phone) || undefined,
    summary: [svc?.label, bt?.label, `${dogs} dog${dogs > 1 ? "s" : ""}`]
      .filter(Boolean)
      .join(" · "),
    details,
  };
}
