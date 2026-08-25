import { Redirect } from "expo-router";

/**
 * App entry point. Once real auth-gated screens exist (home, profile, etc.)
 * this should redirect to them when a session is already active and only
 * fall back to /login when signed out.
 */
export default function Index() {
  return <Redirect href="/login" />;
}
