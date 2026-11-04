import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

/**
 * Push notifications (Expo push service). Once someone is signed in we ask
 * permission, save this phone's Expo push token on their profile
 * (profiles.push_token), and the website sends to it — e.g. a reply in chat,
 * their meet & greet being booked, or their next steps after it.
 *
 * Each notification can carry `data.path` (an app route like "/chat"),
 * opened when it's tapped.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Ask for permission (if it can still be asked) and save this phone's token. The owners' welcome calls it from "Allow notifications". */
export async function registerToken(userId: string): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Nelly & Nova",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted && existing.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return;

  const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  if (!projectId) return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await supabase.from("profiles").update({ push_token: token }).eq("id", userId);
}

function openFromNotification(response: Notifications.NotificationResponse | null) {
  const path = response?.notification.request.content.data?.path;
  if (typeof path === "string" && path.startsWith("/")) router.push(path as never);
}

/** Call once, inside the signed-in part of the app. */
export function usePushNotifications(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId) return;
    registerToken(userId).catch((err) => console.warn("Push registration failed", err));
  }, [userId]);

  useEffect(() => {
    // Opened by tapping a notification while the app was closed…
    Notifications.getLastNotificationResponseAsync().then(openFromNotification).catch(() => {});
    // …or while it was running.
    const sub = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    return () => sub.remove();
  }, []);
}
