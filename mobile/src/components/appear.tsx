import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, Platform, type StyleProp, type ViewStyle } from "react-native";

/**
 * A row or card arriving: it fades in while rising 8px, a little after the
 * one above it (30ms apart, the 8th row and below all together), so a
 * list lands one row at a time instead of all at once.
 *
 * Plays once, when the row first mounts — a refresh that keeps the same
 * rows (same keys) doesn't replay it. Rows far down a long list (index 10
 * and on, rendered off-screen) just appear, so scrolling never waits on it.
 *
 * Wraps its children in a View: give it the layout style the child had in
 * its parent (flex: 1 in a row, a grid tile's width) so nothing moves.
 */
export function Appear({ index = 0, style, children }: { index?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const animate = index < 10;
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) return;
    Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      delay: Math.min(index, 7) * 30,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start();
    // Once, on first appearance.
  }, []);

  if (!animate) return <Animated.View style={style}>{children}</Animated.View>;
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>{children}</Animated.View>;
}
