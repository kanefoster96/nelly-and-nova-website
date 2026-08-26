"use server";

import { createClient } from "@/lib/supabase/server";
import { notifyMember } from "@/lib/push/notify";

export async function approveReschedule(input: {
  requestId: string;
  accountId: string;
  dogName: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reschedule_requests")
    .update({ status: "approved" })
    .eq("id", input.requestId);
  if (error) return { error: error.message };

  await notifyMember({
    accountId: input.accountId,
    kind: "reschedule_accepted",
    title: "Reschedule accepted",
    body: `${input.dogName}'s reschedule request has been accepted — check Calendar for the new time.`,
  });

  return { error: null };
}

export async function declineReschedule(requestId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reschedule_requests")
    .update({ status: "declined" })
    .eq("id", requestId);
  return { error: error?.message ?? null };
}
