import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/nav/next";

/**
 * Where the "confirm your email" link lands. Handles both kinds of link
 * Supabase sends (?token_hash=…&type=… and ?code=…), signs them in, and opens
 * their profile with a welcome. A used or expired link goes to log in with a
 * note to try logging in (most often they already confirmed).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");

  const supabase = await createClient();
  let ok = false;
  try {
    if (tokenHash && type) {
      ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
    } else if (code) {
      ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
    }
  } catch {
    ok = false;
  }

  const next = safeNext(url.searchParams.get("next"));
  const target = ok ? next ?? "/profile?welcome=1" : `/login?confirm=failed${next ? `&next=${encodeURIComponent(next)}` : ""}`;
  return NextResponse.redirect(new URL(target, url.origin));
}
