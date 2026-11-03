import { useId, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

/**
 * A glass edge for something floating (the bottom bar, the Pay button, a
 * row of choices): a 1px outline that catches the light, bright at the top
 * left, nearly gone along the middle and glinting again at the bottom
 * right, instead of one flat line. Drawn over its parent, which it fills;
 * give it the parent's corner radius.
 *
 * Ordinary cards use GLASS_BORDER (lib/theme) instead: the same idea from
 * plain borders, with nothing to draw, for long lists of them.
 */
export function GlassEdge({ radius, colour = "#ffffff", strength = 1 }: { radius: number; colour?: string; strength?: number }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  // An SVG id can't have the colons useId gives.
  const id = `glass${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const a = (n: number) => Math.min(1, n * strength);
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
      }}
    >
      {size && size.w > 1 && size.h > 1 && (
        <Svg width={size.w} height={size.h}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colour} stopOpacity={a(0.45)} />
              <Stop offset="0.28" stopColor={colour} stopOpacity={a(0.14)} />
              <Stop offset="0.55" stopColor={colour} stopOpacity={a(0.05)} />
              <Stop offset="0.8" stopColor={colour} stopOpacity={a(0.1)} />
              <Stop offset="1" stopColor={colour} stopOpacity={a(0.32)} />
            </LinearGradient>
          </Defs>
          <Rect
            x={0.5}
            y={0.5}
            width={size.w - 1}
            height={size.h - 1}
            rx={Math.min(radius, (size.h - 1) / 2)}
            fill="none"
            stroke={`url(#${id})`}
            strokeWidth={1}
          />
        </Svg>
      )}
    </View>
  );
}
