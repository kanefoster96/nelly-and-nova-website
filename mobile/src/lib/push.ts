/**
 * Real OS push notifications (the phone buzzes even with the app closed) —
 * on top of the in-app/Realtime notifications in lib/notifications.ts,
 * which work regardless of this.
 *
 * Getting a push token requires this project to be linked to an EAS
 * project (`npx eas init` — a one-time step needing a free Expo account,
 * not done yet here). Until then `registerForPushNotifications()` no-ops
 * with a console warning; nothing here needs code changes once it's linked
 * — `app.json`'s `extra.eas.projectId` just needs to exist.
 *
 * Also note: push notifications need a development build, not Expo Go
 * (Expo Go dropped remote push support in SDK 53) — `expo run:ios` /
 * `expo run:android`, or an EAS build.
 */
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { supabase } from "@/lib/supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Request permission, get an Expo push token, and save it on the account. Safe to call repeatedly. */
export async function registerForPushNotifications(): Promise<void> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn("[push] No EAS project linked (extra.eas.projectId) — run `eas init` to enable push notifications.");
    return;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") return;

  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (error) {
    console.warn("[push] Failed to get an Expo push token", error);
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("profiles").update({ push_token: token }).eq("id", user.id);
}

/**
 * Send one push notification via the `send-push` Edge Function (admin-only —
 * it checks the caller's role itself, on top of RLS). Best-effort: errors
 * are swallowed since the in-app/Realtime notification is the source of
 * truth and already delivered by the time this is called.
 */
export async function sendPushNotification(
  pushToken: string,
  title: string,
  message: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.functions.invoke("send-push", { body: { pushToken, title, message, data } });
  } catch (error) {
    console.warn("[push] send-push failed", error);
  }
}
