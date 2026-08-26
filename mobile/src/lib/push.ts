import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Ask for permission, grab an Expo push token and save it to
 * `profiles.push_token` so the website's admin actions (chat reply,
 * reschedule accepted, report card published) can push to this device.
 *
 * No-ops quietly (console warning) when there's no EAS project linked yet
 * (`extra.eas.projectId` in app.json — set by `npx eas init`) or when running
 * on a simulator, which can't receive real push. The in-app/Realtime
 * notifications (lib/notifications.ts, the bell) work either way.
 */
export async function registerForPushNotifications(): Promise<void> {
  if (!Device.isDevice) {
    console.warn("[push] skipped — simulators can't receive real push notifications.");
    return;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn("[push] skipped — no EAS project linked yet (run `npx eas init`).");
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
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== "granted") {
    console.warn("[push] permission not granted.");
    return;
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("profiles").update({ push_token: token }).eq("id", user.id);
}
