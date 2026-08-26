/**
 * Requests against the schedule — real `reschedule_requests` and
 * `booking_requests` tables. Members can't edit `training_sessions`
 * directly (trainer-only per RLS); a reschedule/cancellation is a request
 * the trainer reviews, same as the website's own cancellation policy. No
 * date picker yet — the reason field is where a preferred date goes for
 * now, to avoid pulling in a native date-picker dependency for this pass.
 */
import { supabase } from "@/lib/supabase";

export async function requestReschedule(sessionId: string, reason: string): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("reschedule_requests").insert({
    session_id: sessionId,
    requested_by: user.id,
    reason: reason.trim() || null,
  });
  return { error: error?.message ?? null };
}

export async function requestCancellation(sessionId: string, reason: string): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("reschedule_requests").insert({
    session_id: sessionId,
    requested_by: user.id,
    reason: `Cancellation requested. ${reason.trim()}`.trim(),
  });
  return { error: error?.message ?? null };
}

export async function requestExtraSession(input: {
  ownerName: string;
  email: string;
  dogName: string;
  message: string;
}): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("booking_requests").insert({
    account_id: user?.id ?? null,
    name: input.ownerName,
    email: input.email,
    dog_name: input.dogName,
    kind: "extra_session",
    message: input.message.trim() || null,
  });
  return { error: error?.message ?? null };
}
