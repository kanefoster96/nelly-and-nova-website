"use server";

import { redirect } from "next/navigation";
import { deleteAccountFor } from "@/lib/account/delete";
import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Closes the signed-in owner's account, then signs every device out. */
export async function deleteMyAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/delete");
  if (!adminConfigured()) redirect(`/account/delete?error=${encodeURIComponent("Please try again later, or contact us.")}`);

  const result = await deleteAccountFor(createAdminClient(), user.id);
  if (!result.success) redirect(`/account/delete?error=${encodeURIComponent(result.error)}`);

  await supabase.auth.signOut({ scope: "global" });
  redirect("/?deleted=1");
}
