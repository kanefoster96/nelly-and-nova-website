import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * App notifications through Expo's push service. The app saves each
 * phone's Expo push token on profiles.push_token when they sign in
 * (mobile/src/lib/push.ts). Called with a trainer's Supabase client (which
 * can read profiles). Best-effort: never throws, resolves to whether it went.
 *
 * Titles start with one emoji, like Kanvas's automated notices.
 */
export async function pushToAccount(
  supabase: SupabaseClient,
  accountId: string,
  message: { title: string; body: string; path?: string }
): Promise<boolean> {
  try {
    const { data } = await supabase.from("profiles").select("push_token").eq("id", accountId).maybeSingle();
    const token = data?.push_token as string | null | undefined;
    if (!token || !token.startsWith("ExponentPushToken")) return false;
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        to: token,
        sound: "default",
        title: message.title,
        body: message.body,
        data: message.path ? { path: message.path } : {},
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("pushToAccount failed", err);
    return false;
  }
}
