import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { NotificationsProvider } from "@/lib/notifications-context";
import { useOtaUpdates } from "@/lib/useOtaUpdates";
import { colors } from "@/theme";

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { session, loading } = useAuth();

  // Keep the splash up until we know whether someone is signed in, so members
  // never see a flash of the login screen.
  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      {/* Members only: everything behind sign-in. */}
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  useOtaUpdates();
  return (
    <AuthProvider>
      <NotificationsProvider>
        <StatusBar style="light" />
        <RootStack />
      </NotificationsProvider>
    </AuthProvider>
  );
}
