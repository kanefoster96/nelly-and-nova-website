import { Redirect } from "expo-router";

import { useAuth } from "@/auth/AuthProvider";

/** "/" → the right place for who's signed in. */
export default function Index() {
  const { session } = useAuth();
  return <Redirect href={session ? "/community" : "/sign-in"} />;
}
