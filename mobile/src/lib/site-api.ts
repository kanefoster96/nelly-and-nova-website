import { config } from "@/lib/config";
import { supabase } from "@/lib/supabase";

/**
 * POST to one of the website's API routes as the signed-in person
 * ("Authorization: Bearer <their token>"), for what needs the website's
 * keys: GoCardless, email, pushes. Throws an Error with a friendly message,
 * or the route's own `error`.
 */
export async function postToSite<T extends Record<string, unknown>>(path: string, body: unknown, fallbackError: string): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  let res: Response;
  try {
    res = await fetch(new URL(path, config.siteUrl).toString(), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Couldn't reach the website. Check your connection and try again.");
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error || fallbackError);
  return json;
}
