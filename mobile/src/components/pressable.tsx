import { forwardRef, useEffect, useRef, useState, type ElementRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable as RNPressable,
  StyleSheet,
  useWindowDimensions,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PressableProps as RNPressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { hapticLongPress, hapticsFired, hapticTap } from "@/lib/haptics";

/**
 * The app's one Pressable: a drop-in for React Native's, used for every
 * button, card, row and tab, so they all answer a finger the same way.
 *
 *  - Finger down: shrinks to 97% (98.5% for big cards and rows) and fades
 *    to 82%, fast and flat. Release: springs back with a small overshoot.
 *  - A light tap on every press and a firmer one on a long press, unless
 *    the press's own handler already fired a haptic (a selection tick, an
 *    error, the payment sheet) — so one tap is never felt twice.
 *  - A backdrop (the `backdrop` prop, or anything over half the screen
 *    tall) neither moves nor buzzes.
 *
 * Nothing about the look or layout changes: the press is the same single
 * view with the same style as before, and only its scale and opacity
 * animate, which never affect layout. (An earlier version split the style
 * across two layers, and React Native's layout let some inner layers
 * stretch — the Collect button on Orders grew down the page.) A style
 * function's own "pressed" look is retired in favour of this one feel.
 */

export type PressableProps = RNPressableProps & {
  /**
   * "none" for a press that shouldn't buzz itself (the tab bar has its own
   * firmer tap). Toggles and pickers needn't say: their handler's
   * selection tick is seen and the light tap skipped.
   */
  haptic?: "light" | "none";
  /** Override the pressed scale. */
  scaleTo?: number;
  /**
   * A sheet's backdrop or a tap-to-dismiss area: no movement, no haptic.
   * (Anything over half the screen tall is treated this way already.)
   */
  backdrop?: boolean;
};

const PRESSED_OPACITY = 0.82;
const SMALL_SCALE = 0.97;
const LARGE_SCALE = 0.985;
const useNativeDriver = Platform.OS !== "web";

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

/** The style as given, minus its own opacity and transform, which join the animated ones. */
function splitStyle(style: StyleProp<ViewStyle>): { rest: ViewStyle; opacity: number; transform: NonNullable<ViewStyle["transform"]> } {
  const { opacity = 1, transform, ...rest } = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  return { rest, opacity: typeof opacity === "number" ? opacity : 1, transform: Array.isArray(transform) ? transform : [] };
}

type Size = "small" | "large" | "screen";

export const Pressable = forwardRef<ElementRef<typeof RNPressable>, PressableProps>(function Pressable(
  { style, children, onPress, onLongPress, onPressIn, onPressOut, onLayout, haptic = "light", scaleTo, backdrop = false, ...rest },
  ref,
) {
  const window = useWindowDimensions();
  const scale = useRef(new Animated.Value(1)).current;
  const [size, setSize] = useState<Size>("small");
  const interactive = !!(onPress || onLongPress);
  const quiet = backdrop || size === "screen";
  const still = quiet || !interactive;
  const pressedScale = scaleTo ?? (size === "large" ? LARGE_SCALE : SMALL_SCALE);

  const resolved = typeof style === "function" ? style({ pressed: false }) : style;
  const { rest: look, opacity: ownOpacity, transform: ownTransform } = splitStyle(resolved);
  const opacity = useRef(new Animated.Value(ownOpacity)).current;

  // The style's own opacity (a dimmed, not-ready-yet button) lives in the
  // one animated value, so it updates the moment it changes. Swapping in a
  // new animated node instead left a button dim until something else
  // redrew it (the trial form's arrow stayed grey until the field blurred).
  useEffect(() => {
    opacity.setValue(ownOpacity);
  }, [ownOpacity, opacity]);

  function measure(e: LayoutChangeEvent) {
    onLayout?.(e);
    const { width, height } = e.nativeEvent.layout;
    const radius = typeof look.borderRadius === "number" ? look.borderRadius : 0;
    const pill = radius >= height / 2;
    const next: Size =
      height > window.height * 0.5
        ? "screen"
        : height >= 60 || (width >= window.width * 0.7 && !pill)
          ? "large"
          : "small";
    if (next !== size) setSize(next);
  }

  function pressIn(e: GestureResponderEvent) {
    onPressIn?.(e);
    if (still) return;
    Animated.parallel([
      Animated.timing(scale, { toValue: pressedScale, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver }),
      Animated.timing(opacity, { toValue: ownOpacity * PRESSED_OPACITY, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver }),
    ]).start();
  }

  function pressOut(e: GestureResponderEvent) {
    onPressOut?.(e);
    if (still) return;
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, speed: 40, bounciness: 6, useNativeDriver }),
      Animated.timing(opacity, { toValue: ownOpacity, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver }),
    ]).start();
  }

  function press(e: GestureResponderEvent) {
    const before = hapticsFired();
    onPress?.(e);
    if (haptic === "light" && !quiet && hapticsFired() === before) hapticTap();
  }

  function longPress(e: GestureResponderEvent) {
    const before = hapticsFired();
    onLongPress?.(e);
    if (!quiet && hapticsFired() === before) hapticLongPress();
  }

  return (
    <AnimatedPressable
      ref={ref}
      {...rest}
      style={[
        look,
        still
          ? { opacity: ownOpacity, transform: ownTransform }
          : ({
              opacity,
              transform: [...ownTransform, { scale }],
            } as unknown as ViewStyle),
      ]}
      onLayout={measure}
      onPressIn={pressIn}
      onPressOut={pressOut}
      onPress={onPress ? press : undefined}
      onLongPress={onLongPress ? longPress : undefined}
    >
      {children}
    </AnimatedPressable>
  );
});
