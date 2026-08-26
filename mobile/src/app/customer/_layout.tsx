import { Redirect, Stack } from "expo-router";
import { hasActiveMembership, useAuthStatus, useSession } from "@/lib/session";
import { colors } from "@/theme/colors";

/**
 * Guards the whole /customer subtree: only signed-in members with a dog on
 * the account land here (see src/app/index.tsx for the routing that gets
 * people here in the first place — this is just defence in depth against a
 * direct deep link). Kept as a Stack (even though "(tabs)" is the only
 * screen registered right now) so a future pushed detail screen — a report
 * card, a specific walk, etc. — has somewhere to slot in without
 * restructuring this file again.
 */
export default function CustomerLayout() {
  const status = useAuthStatus();
  const session = useSession();

  if (status === "loading") return null;
  if (status === "anon" || !session) return <Redirect href="/login" />;
  if (session.role === "admin") return <Redirect href="/admin" />;
  if (!hasActiveMembership(session)) return <Redirect href="/pending" />;

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.ink },
        headerStyle: { backgroundColor: colors.ink },
        headerTintColor: colors.paper,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
