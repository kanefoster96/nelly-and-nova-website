import { Stack } from "expo-router";

import { colors } from "@/theme";

// Wraps the tab shell — Profile, Notifications, a conversation and a drill
// page push on top as full screens (tab bar hidden underneath), same as the
// Kanvas app / Instagram.
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="conversation/[id]" />
      <Stack.Screen name="drill/[id]" />
    </Stack>
  );
}
