import { useEffect } from "react";
import { Redirect, Stack } from "expo-router";
import { hasActiveMembership, useAuthStatus, useSession } from "@/lib/session";
import { registerForPushNotifications } from "@/lib/push";
import { colors } from "@/theme/colors";

/**
 * Guards the whole /customer subtree: only signed-in members with a dog on
 * the account land here (see src/app/index.tsx for the routing that gets
 * people here in the first place — this is just defence in depth against a
 * direct deep link). A Stack with "(tabs)" plus two pushed screens —
 * notifications (from the bell) and messages (from the chat icon), neither
 * of which is a 6th tab.
 */
export default function CustomerLayout() {
  const status = useAuthStatus();
  const session = useSession();

  useEffect(() => {
    if (session) void registerForPushNotifications();
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
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
      <Stack.Screen name="messages" options={{ title: "Messages" }} />
    </Stack>
  );
}
