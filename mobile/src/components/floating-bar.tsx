import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Keyboard, Platform, StyleSheet, View } from "react-native";

import { GlassEdge } from "@/components/glass-edge";
import { Pressable } from "@/components/pressable";
import { hapticTab } from "@/lib/haptics";
import { BAR_HEIGHT, useBarBottom, useFloatingBarState } from "@/lib/floating-bar";
import { colors, GLASS_FILL } from "@/theme";

/**
 * The floating bar along the bottom of the tabs, in place of a plain tab
 * bar — the Kanvas app's components/floating-bar.tsx: a near-solid dark
 * pill over the page with a light-catching glass edge, which shrinks (and
 * drops its labels) while the page scrolls down. A grey selector slides
 * along to the tab that's showing; it moves the moment a tab is tapped,
 * before the page arrives. Tapping the tab you're on takes its page back
 * to the top. It steps aside for the keyboard. Plain views only (no native
 * blur), so it looks the same on iPhone and Android and ships over the air.
 */

export type BarTab = {
  key: string;
  label: string;
  /** The icon, given whether this tab is the one showing and the colour to draw it in. */
  icon: (focused: boolean, color: string) => ReactNode;
  onPress: () => void;
};

/** Room between the bar's edge and the selector. */
const INSET = 6;
/** A tab's label: its line height and the gap above it. */
const LABEL_HEIGHT = 13;
const LABEL_GAP = 3;

export function FloatingBar({ tabs, activeKey }: { tabs: BarTab[]; activeKey: string | null }) {
  const bottom = useBarBottom();
  const { collapse, setCollapsed, scrollToTop } = useFloatingBarState();
  const [keyboard, setKeyboard] = useState(false);

  // Steps aside for the keyboard, so it never covers what's being typed.
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboard(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Full size again on another tab.
  useEffect(() => {
    setCollapsed(false);
  }, [activeKey, setCollapsed]);

  const shown = !keyboard;
  const showing = useRef(new Animated.Value(shown ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(showing, { toValue: shown ? 1 : 0, useNativeDriver: true, speed: 16, bounciness: 3 }).start();
  }, [shown, showing]);

  // The tab just tapped shows as selected straight away; the page catches up.
  const [tapped, setTapped] = useState<string | null>(null);
  useEffect(() => setTapped(null), [activeKey]);
  useEffect(() => {
    if (!tapped) return;
    const timer = setTimeout(() => setTapped(null), 800);
    return () => clearTimeout(timer);
  }, [tapped]);
  const selectedKey = tapped ?? activeKey;
  const selectedIndex = tabs.findIndex((t) => t.key === selectedKey);

  // The selector: one tab wide, sliding to the selected one.
  const [rowWidth, setRowWidth] = useState(0);
  const tabWidth = tabs.length ? (rowWidth - INSET * 2) / tabs.length : 0;
  const tabLeft = INSET + Math.max(0, selectedIndex) * tabWidth;
  const slide = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  useEffect(() => {
    if (!tabWidth) return;
    if (!placed.current) {
      // First time it has a place: there, with no slide in from the left.
      placed.current = true;
      slide.setValue(tabLeft);
    } else {
      Animated.spring(slide, { toValue: tabLeft, useNativeDriver: true, speed: 22, bounciness: 5 }).start();
    }
  }, [tabLeft, tabWidth, slide]);

  const scale = collapse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] });
  const lift = collapse.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });
  const hide = showing.interpolate({ inputRange: [0, 1], outputRange: [BAR_HEIGHT + bottom + 40, 0] });
  const labels = collapse.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0], extrapolate: "clamp" });
  // With the labels gone the icons drop by half a label (and its gap), so they sit in the middle of the bar.
  const iconDrop = collapse.interpolate({ inputRange: [0, 1], outputRange: [0, (LABEL_HEIGHT + LABEL_GAP) / 2] });

  return (
    <Animated.View
      pointerEvents={shown ? "box-none" : "none"}
      accessibilityElementsHidden={!shown}
      importantForAccessibility={shown ? "auto" : "no-hide-descendants"}
      accessibilityRole="tablist"
      style={{
        position: "absolute",
        left: 14,
        right: 14,
        bottom,
        height: BAR_HEIGHT,
        transform: [{ translateY: Animated.add(hide, lift) }, { scale }],
      }}
    >
      {/* The bar: near-solid, with a fine light edge. */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: BAR_HEIGHT / 2, backgroundColor: GLASS_FILL, boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }]} />
      <GlassEdge radius={BAR_HEIGHT / 2} />

      {/* The selector. */}
      {tabWidth > 0 && selectedIndex >= 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: INSET,
            bottom: INSET,
            width: tabWidth,
            borderRadius: (BAR_HEIGHT - INSET * 2) / 2,
            backgroundColor: "rgba(245,242,234,0.12)",
            transform: [{ translateX: slide }],
          }}
        />
      )}

      {/* The tabs. */}
      <View
        pointerEvents="box-none"
        onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
        style={[StyleSheet.absoluteFill, { flexDirection: "row", alignItems: "center", paddingHorizontal: INSET }]}
      >
        {tabs.map((tab) => {
          const focused = tab.key === selectedKey;
          const colour = focused ? colors.foreground : colors.muted;
          return (
            <Pressable
              key={tab.key}
              haptic="none"
              onPress={() => {
                hapticTab();
                // Already on it: back to the top, as on Instagram.
                if (tab.key === activeKey) {
                  scrollToTop();
                  return;
                }
                setTapped(tab.key);
                tab.onPress();
              }}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: focused }}
              style={{ flex: 1, height: BAR_HEIGHT, alignItems: "center", justifyContent: "center", gap: LABEL_GAP }}
            >
              <Animated.View style={{ transform: [{ translateY: iconDrop }] }}>{tab.icon(focused, colour)}</Animated.View>
              {/* One weight, selected or not: bold is wider and would jostle the row. */}
              <Animated.Text allowFontScaling={false} numberOfLines={1} style={{ color: colour, fontSize: 10, lineHeight: LABEL_HEIGHT, fontWeight: "600", opacity: labels }}>
                {tab.label}
              </Animated.Text>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}
