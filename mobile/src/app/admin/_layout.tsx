import { useEffect } from "react";
import { Redirect, Stack } from "expo-router";
import { useAuthStatus, useSession } from "@/lib/session";
import { registerForPushNotifications } from "@/lib/push";
import { colors } from "@/theme/colors";

/**
 * Guards the whole /admin subtree: only signed-in trainers land here (see
 * src/app/index.tsx for the routing). A Stack with "(tabs)" plus pushed
 * screens — notifications, the conversation list, and a chat thread —
 * mirroring customer/_layout.tsx's shape.
 */
export default function AdminLayout() {
  const status = useAuthStatus();
  const session = useSession();

  useEffect(() => {
    if (session) void registerForPushNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  if (status === "loading") return null;
  if (status === "anon" || !session) return <Redirect href="/login" />;
  if (session.role !== "admin") return <Redirect href="/customer" />;

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
      <Stack.Screen name="messages/index" options={{ title: "Chat" }} />
      <Stack.Screen name="messages/[id]" options={{ title: "" }} />
    </Stack>
  );
}
