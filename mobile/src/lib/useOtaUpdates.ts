import * as Updates from "expo-updates";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

/** Don't hit the update server more than this often when returning to the app. */
const MIN_CHECK_INTERVAL_MS = 15 * 60 * 1000;

/**
 * EAS Update: the native side already checks on every cold start
 * (`updates.checkAutomatically: ON_LOAD`) and applies on the next launch.
 * This also checks when the app returns to the foreground, so people who never
 * swipe the app away still get fixes, and applies a downloaded update the next
 * time the app is backgrounded — never mid-use.
 */
export function useOtaUpdates() {
  const { isUpdatePending } = Updates.useUpdates();
  const lastCheck = useRef(0);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;

    const sub = AppState.addEventListener("change", async (state) => {
      if (state === "background" && isUpdatePending) {
        await Updates.reloadAsync().catch(() => {});
        return;
      }
      if (state !== "active" || Date.now() - lastCheck.current < MIN_CHECK_INTERVAL_MS) return;
      lastCheck.current = Date.now();
      try {
        const { isAvailable } = await Updates.checkForUpdateAsync();
        if (isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        // Offline or server hiccup — try again next foreground.
      }
    });
    return () => sub.remove();
  }, [isUpdatePending]);
}
