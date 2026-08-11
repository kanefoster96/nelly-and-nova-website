/**
 * Proxy (formerly "middleware" — renamed in Next.js 16). Runs before each
 * matched request and refreshes the Supabase auth session cookie so Server
 * Components always see a valid session.
 *
 * If Supabase env vars aren't set yet, this is a no-op so the site keeps
 * working while the backend is being wired up.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Not configured yet — pass through untouched.
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Touch the session so an expired token gets refreshed and re-set on the
  // response. Do not run code between createServerClient and getUser().
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Run on everything except static assets and image optimisation.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|placeholders|media|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4)$).*)",
  ],
};
