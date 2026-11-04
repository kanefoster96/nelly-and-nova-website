import { Stack } from "expo-router";

import { useAuth } from "@/auth/AuthProvider";
import { usePushNotifications } from "@/lib/push";
import { useWelcomeSeen } from "@/lib/welcome";
import { colors } from "@/theme";

// Wraps the tab shell — Profile, Notifications, a conversation and a drill
// page push on top as full screens (tab bar hidden underneath), same as the
// Kanvas app / Instagram.
export default function AppLayout() {
  // Signed in: ask for notifications and save this phone's push token.
  // Owners are asked only once the welcome has said why (app/(app)/welcome.tsx,
  // whose "Allow notifications" asks); trainers straight away.
  const { session, isTrainer } = useAuth();
  const welcomed = useWelcomeSeen(session?.user.id);
  usePushNotifications(isTrainer || welcomed ? session?.user.id : undefined);
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      {/* Owners' first-launch welcome (once per account on this phone). */}
      <Stack.Screen name="welcome" options={{ animation: "fade", gestureEnabled: false }} />
      <Stack.Screen name="profile" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="conversation/[id]" />
      <Stack.Screen name="drill/[id]" />
      {/* Owner pages: registering a dog, My Info, a dog's record, adding a dog, one homework. */}
      <Stack.Screen name="register/index" />
      <Stack.Screen name="register/[dogId]" />
      <Stack.Screen name="my-info" />
      <Stack.Screen name="my-dogs/[id]" />
      <Stack.Screen name="my-dogs/new" />
      <Stack.Screen name="homework-detail/[id]" />
      {/* Trainer pages: the Calendar, a day on it, adding a dog to a day, a dog, a report card, and Menu's pages. */}
      <Stack.Screen name="calendar" />
      <Stack.Screen name="day/[date]" />
      <Stack.Screen name="add-dog" />
      <Stack.Screen name="dog/[id]" />
      <Stack.Screen name="library" />
      <Stack.Screen name="report-card" />
      <Stack.Screen name="write-reports" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="onboarding/[id]" />
      <Stack.Screen name="team" />
      <Stack.Screen name="guidelines" />
      <Stack.Screen name="send-notification" />
      <Stack.Screen name="delete-account" />
    </Stack>
  );
}
