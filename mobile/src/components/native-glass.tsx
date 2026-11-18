import { useSyncExternalStore } from "react";
import { AccessibilityInfo, Platform, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";

/**
 * Apple's own Liquid Glass (iOS 26 and later), for the things that float:
 * the bar along the bottom (components/floating-bar.tsx) and the round
 * buttons at the top of a page (components/glass-button.tsx). Everything
 * else stays as it was. (From the Kanvas app's components/native-glass.tsx.)
 *
 * expo-glass-effect comes with expo-router, so it's already in every build
 * of the app; this only draws it where the phone supports it. Anywhere else
 * (older iPhones, Android) LIQUID_GLASS is false and the caller keeps its
 * near-solid fill. With Reduce Transparency on, callers go fully solid.
 */
export const LIQUID_GLASS = Platform.OS === "ios" && isLiquidGlassAvailable();

export function NativeGlass({
  radius,
  tint,
  interactive = false,
  style,
}: {
  radius: number;
  /** A colour washed into the glass. */
  tint?: string;
  /** Lights up under the finger, as Apple's own buttons do. */
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <GlassView
      pointerEvents="none"
      glassEffectStyle="regular"
      colorScheme="dark"
      tintColor={tint}
      isInteractive={interactive}
      style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }, style]}
    />
  );
}

/*
 * Reduce Transparency (Settings → Accessibility → Display & Text Size),
 * watched once for the whole app, as the Kanvas app's lib/motion.ts does.
 */
const transparency = { value: false, listeners: new Set<() => void>() };

function setReduced(value: boolean) {
  if (transparency.value === value) return;
  transparency.value = value;
  transparency.listeners.forEach((l) => l());
}

if (Platform.OS === "ios") {
  try {
    AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then((v) => setReduced(!!v))
      .catch(() => {});
    AccessibilityInfo.addEventListener("reduceTransparencyChanged", (v: boolean) => setReduced(!!v));
  } catch {
    // Not available here: normal materials.
  }
}

function subscribe(listener: () => void) {
  transparency.listeners.add(listener);
  return () => {
    transparency.listeners.delete(listener);
  };
}
const read = () => transparency.value;

/** Reduce Transparency (iPhone only), re-rendering when it's switched. */
export function useReducedTransparency(): boolean {
  return useSyncExternalStore(subscribe, read, read);
}
