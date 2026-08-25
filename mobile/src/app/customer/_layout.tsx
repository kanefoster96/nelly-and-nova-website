import { useEffect } from "react";
import { Redirect, Stack } from "expo-router";
import { hasActiveMembership, useAuthStatus, useSession } from "@/lib/session";
import { registerForPushNotifications } from "@/lib/push";
import { colors } from "@/theme/colors";

/**
 * Guards the whole /customer subtree: only signed-in members with a dog on
 * the account land here (see src/app/index.tsx for the routing that gets
 * people here in the first place — this is just defence in depth against a
 * direct deep link). Everything under here is either the tab shell
 * ("(tabs)") or a screen pushed on top of it (e.g. "profile"), which is why
 * this is a Stack rather than rendering the tabs directly.
 */
export default function CustomerLayout() {
  const status = useAuthStatus();
  const session = useSession();

  useEffect(() => {
    if (session) void registerForPushNotifications();
    // Register once per signed-in account, not on every session object change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

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
      <Stack.Screen name="profile" options={{ title: "Profile" }} />
      <Stack.Screen name="walks/track" options={{ title: "Track a walk", headerShown: false }} />
      <Stack.Screen name="walks/[id]" options={{ title: "Walk" }} />
      <Stack.Screen name="pickup-location" options={{ title: "Pickup location" }} />
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
    </Stack>
  );
}
