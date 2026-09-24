import Svg, { Path, Rect } from "react-native-svg";

import { colors } from "@/theme";

/** The "ИN" monogram, drawn to match the app icon. */
export function Logo({ size = 96, color = colors.paper }: { size?: number; color?: string }) {
  // Geometry in the 447-unit space of the source artwork.
  const w = 13, h = 132, lw = 118, gap = 44, dx = w * 1.25;
  const x0 = (447 - (2 * lw + gap)) / 2, top = (447 - h) / 2, bot = top + h;
  const letter = (x: number, mirrored: boolean) => (
    <>
      <Rect x={x} y={top} width={w} height={h} fill={color} />
      <Rect x={x + lw - w} y={top} width={w} height={h} fill={color} />
      <Path
        fill={color}
        d={
          mirrored
            ? `M${x} ${bot} L${x + dx} ${bot} L${x + lw} ${top} L${x + lw - dx} ${top} Z`
            : `M${x} ${top} L${x + dx} ${top} L${x + lw} ${bot} L${x + lw - dx} ${bot} Z`
        }
      />
    </>
  );
  return (
    <Svg width={size} height={size} viewBox="0 0 447 447" accessibilityLabel="Nelly & Nova">
      {letter(x0, true)}
      {letter(x0 + lw + gap, false)}
    </Svg>
  );
}
