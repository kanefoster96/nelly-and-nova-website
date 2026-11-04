import { addressLine } from "@/lib/contact";
import { supabase } from "@/lib/supabase";

/**
 * Who a trainer books in from a day (components/trainer/person-picker.tsx):
 * an existing customer and one of their dogs, an open request (enquiries:
 * meet & greet requests and contact messages not yet closed), or someone
 * new, who's saved as a request so they can be onboarded later. Trainers
 * read every profile, dog and enquiry under Row Level Security.
 */

export type PickerDog = { id: string; name: string; breed: string | null; photoUrl: string | null; registered: boolean };

export type Customer = {
  accountId: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  dogs: PickerDog[];
};

export type OpenRequest = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  dogNames: string | null;
  service: string | null;
  status: "new" | "meet_greet_booked" | "onboarding";
  meetGreetAt: string | null;
  accountId: string | null;
  /** Where the meet & greet is, or the postcode they gave. */
  address: string | null;
};

export type Picked = { type: "customer"; customer: Customer; dog: PickerDog | null } | { type: "request"; request: OpenRequest; isNew?: boolean };

type ProfileRow = {
  id: string;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  pickup_address: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
};
type DogRow = { id: string; name: string; breed: string | null; photo_url: string | null; waiver_signed_at: string | null; account_id: string };

/** Every customer (not the trainers), A–Z, with their dogs. */
export async function listCustomers(): Promise<Customer[]> {
  const [profiles, dogs] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, owner_name, email, phone, pickup_address, address, city, postcode")
      .or("role.is.null,role.neq.admin")
      .order("owner_name")
      .limit(1000),
    supabase.from("dogs").select("id, name, breed, photo_url, waiver_signed_at, account_id").order("name").limit(2000),
  ]);
  if (profiles.error) throw new Error(profiles.error.message);
  if (dogs.error) throw new Error(dogs.error.message);
  const byAccount = new Map<string, PickerDog[]>();
  for (const d of (dogs.data ?? []) as DogRow[]) {
    const list = byAccount.get(d.account_id) ?? [];
    list.push({ id: d.id, name: d.name, breed: d.breed?.trim() || null, photoUrl: d.photo_url, registered: !!d.waiver_signed_at });
    byAccount.set(d.account_id, list);
  }
  return ((profiles.data ?? []) as ProfileRow[])
    .map((p) => ({
      accountId: p.id,
      name: p.owner_name?.trim() || p.email || "Customer",
      email: p.email,
      phone: p.phone?.trim() || null,
      address: addressLine(p),
      dogs: byAccount.get(p.id) ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** A customer matches on their name, email, or any of their dogs' names. */
export function customerMatches(c: Customer, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return c.name.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q) || c.dogs.some((d) => d.name.toLowerCase().includes(q));
}

export function requestMatches(r: OpenRequest, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || (r.dogNames ?? "").toLowerCase().includes(q);
}

function toRequest(r: Record<string, unknown>): OpenRequest {
  const details = (r.details ?? {}) as Record<string, unknown>;
  const address = [r.meet_greet_address, details.address, details.postcode].map((x) => (typeof x === "string" ? x.trim() : "")).find(Boolean) || null;
  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    email: String(r.email ?? ""),
    phone: (r.phone as string | null)?.trim() || null,
    dogNames: (r.dog_names as string | null) ?? null,
    service: (r.service as string | null) ?? null,
    status: r.status as OpenRequest["status"],
    meetGreetAt: (r.meet_greet_at as string | null) ?? null,
    accountId: (r.account_id as string | null) ?? null,
    address,
  };
}

/** Requests still open (not closed), newest first. */
export async function listOpenRequests(): Promise<OpenRequest[]> {
  const { data, error } = await supabase.from("enquiries").select("*").in("status", ["new", "meet_greet_booked", "onboarding"]).order("created_at", { ascending: false }).limit(150);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(toRequest);
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Someone new: saved as a request (an enquiry, like the website's meet &
 * greet form) so they can be onboarded later. If the email already has an
 * account, or an open request, that's used instead.
 */
export async function addPerson(input: { name: string; email: string; phone: string; dogNames: string; service: string }, customers: Customer[] | null): Promise<Picked> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) throw new Error("Add their name.");
  if (!EMAIL_RE.test(email)) throw new Error("Add a valid email, so they can be sent their join link later.");

  const existing = customers?.find((c) => (c.email ?? "").toLowerCase() === email);
  if (existing) return { type: "customer", customer: existing, dog: existing.dogs.length === 1 ? existing.dogs[0] : null };
  const { data: open } = await supabase.from("enquiries").select("*").ilike("email", email).neq("status", "closed").order("created_at", { ascending: false }).limit(1);
  const found = (open ?? [])[0] as Record<string, unknown> | undefined;
  if (found) return { type: "request", request: toRequest(found) };

  const { data, error } = await supabase
    .from("enquiries")
    .insert({
      kind: "booking",
      status: "new",
      name,
      email,
      phone: input.phone.trim() || null,
      dog_names: input.dogNames.trim() || null,
      service: input.service,
      details: { source: "trainer_app" },
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Couldn't save them.");
  return { type: "request", request: toRequest(data as Record<string, unknown>), isNew: true };
}

/** What to call a pick: "Sam Taylor · Biscuit". */
export function pickedTitle(p: Picked): string {
  if (p.type === "customer") return p.dog ? `${p.dog.name} · ${p.customer.name}` : p.customer.name;
  return p.request.dogNames ? `${p.request.name} · ${p.request.dogNames}` : p.request.name;
}

/** The pick's address, to prefill a meet & greet's. */
export function pickedAddress(p: Picked): string | null {
  return p.type === "customer" ? p.customer.address : p.request.address;
}

/** "Sam Taylor — Biscuit": what a held place or booking shows until they register. */
export function holderNameFor(r: OpenRequest): string {
  return r.dogNames ? `${r.name} — ${r.dogNames}` : r.name;
}
