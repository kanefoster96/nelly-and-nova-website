import type { Admin } from "@/lib/supabase/admin";
import { cancelMandate, gocardlessConfigured } from "@/lib/gocardless/client";

export type DeleteAccountResult = { success: true } | { success: false; error: string };

/**
 * Closing an owner's account for good — required by Apple (5.1.1(v)) and
 * Google Play, and shared by the website page and the app's route so both
 * do exactly the same thing (ported from Kanvas Academy's lib/delete-account).
 *
 * 1. Cancel any Direct Debit the site set up with GoCardless, so nothing
 *    keeps collecting. (Only ones in payment_mandates — never anything else
 *    in the GoCardless account.)
 * 2. Delete the login. Everything personal — profile, dogs and their
 *    records and documents, waivers, chat, places and bookings — is wired
 *    to it with "on delete cascade", so it all goes in one step. Their
 *    meet & greet request is kept without the link to the account.
 *
 * Trainer accounts are refused: removing one is a staff decision.
 */
export async function deleteAccountFor(admin: Admin, userId: string): Promise<DeleteAccountResult> {
  const { data: profile } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role === "admin") {
    return { success: false, error: "Trainer accounts can't be deleted from here — please ask Charlotte to remove your access." };
  }

  const { data: mandates } = await admin
    .from("payment_mandates")
    .select("mandate_id, status")
    .eq("account_id", userId)
    .not("mandate_id", "is", null);
  for (const m of mandates ?? []) {
    if (["cancelled", "failed", "expired", "consumed"].includes(m.status as string)) continue;
    if (!gocardlessConfigured()) {
      return { success: false, error: "We couldn't cancel your Direct Debit just now — please contact us so nothing keeps collecting." };
    }
    try {
      await cancelMandate(m.mandate_id as string);
    } catch (err) {
      console.error("deleteAccountFor: Direct Debit cancel failed", err);
      return { success: false, error: "We couldn't cancel your Direct Debit — please contact us so nothing keeps collecting." };
    }
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("deleteAccountFor: delete failed", error);
    return { success: false, error: "We couldn't close the account — please try again, or contact us." };
  }
  return { success: true };
}
