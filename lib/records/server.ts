import { createClient } from "@/lib/supabase/server";

/**
 * Server-side helpers for API routes: saving enquiries from the public forms
 * and checking a request comes from a signed-in trainer.
 */

const supabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export type NewEnquiry = {
  kind: "contact" | "booking";
  name: string;
  email: string;
  phone?: string;
  message?: string;
  service?: string;
  dogNames?: string;
  details?: Record<string, unknown>;
};

/**
 * Save a contact-form message or meet & greet request to the `enquiries`
 * table (the trainer's onboarding list). Returns true if it was stored.
 * Never throws — the caller decides what to tell the visitor.
 */
export async function saveEnquiry(e: NewEnquiry): Promise<boolean> {
  if (!supabaseConfigured()) return false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("enquiries").insert({
      kind: e.kind,
      name: e.name.slice(0, 200),
      email: e.email.slice(0, 200),
      phone: e.phone?.slice(0, 50) || null,
      message: e.message?.slice(0, 5000) || null,
      service: e.service || null,
      dog_names: e.dogNames || null,
      details: e.details ?? {},
      account_id: user?.id ?? null,
    });
    if (error) {
      console.error("[enquiries] insert failed", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[enquiries] insert failed", err);
    return false;
  }
}

/**
 * For trainer-only API routes (sending customer emails). Returns null when the
 * caller is a signed-in trainer, otherwise a 401/403 Response to return.
 */
export async function requireTrainer(): Promise<Response | null> {
  if (!supabaseConfigured()) {
    return Response.json({ error: "Sign-in isn't set up." }, { status: 503 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please log in." }, { status: 401 });
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (data?.role !== "admin") return Response.json({ error: "Trainers only." }, { status: 403 });
  return null;
}
