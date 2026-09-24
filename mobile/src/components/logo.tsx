import Svg, { Path, Rect } from "react-native-svg";

import { colors } from "@/theme";

/** The "ИN" monogram, drawn to match the app icon. */
export function Logo({ size = 72, color = colors.foreground }: { size?: number; color?: string }) {
  // Geometry in the 447-unit space of the source artwork, cropped to the letters.
  const w = 13, h = 132, lw = 118, gap = 44, dx = w * 1.25;
  const total = 2 * lw + gap;
  const letter = (x: number, mirrored: boolean) => (
    <>
      <Rect x={x} y={0} width={w} height={h} fill={color} />
      <Rect x={x + lw - w} y={0} width={w} height={h} fill={color} />
      <Path
        fill={color}
        d={mirrored ? `M${x} ${h} L${x + dx} ${h} L${x + lw} 0 L${x + lw - dx} 0 Z` : `M${x} 0 L${x + dx} 0 L${x + lw} ${h} L${x + lw - dx} ${h} Z`}
      />
    </>
  );
  return (
    <Svg width={size} height={(size * h) / total} viewBox={`0 0 ${total} ${h}`} accessibilityLabel="Nelly & Nova">
      {letter(0, true)}
      {letter(lw + gap, false)}
    </Svg>
  );
}
