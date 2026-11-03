import { Stack } from "expo-router";

import { useAuth } from "@/auth/AuthProvider";
import { usePushNotifications } from "@/lib/push";
import { colors } from "@/theme";

// Wraps the tab shell — Profile, Notifications, a conversation and a drill
// page push on top as full screens (tab bar hidden underneath), same as the
// Kanvas app / Instagram.
export default function AppLayout() {
  // Signed in: ask for notifications and save this phone's push token.
  const { session } = useAuth();
  usePushNotifications(session?.user.id);
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="conversation/[id]" />
      <Stack.Screen name="drill/[id]" />
      {/* Trainer pages: the Calendar, a day on it, adding a dog to a day, a dog, and Menu's moved pages. */}
      <Stack.Screen name="calendar" />
      <Stack.Screen name="day/[date]" />
      <Stack.Screen name="add-dog" />
      <Stack.Screen name="dog/[id]" />
      <Stack.Screen name="library" />
      <Stack.Screen name="trainer-schedule" />
    </Stack>
  );
}
