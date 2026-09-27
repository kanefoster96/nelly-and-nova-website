import Svg, { Path } from "react-native-svg";

import { colors } from "@/theme";

/**
 * The "ИN" monogram — traced from the original artwork (public/brand/nn-logo-*.svg
 * on the website), so it matches the app icon exactly.
 */
export function Logo({ size = 72, color = colors.foreground }: { size?: number; color?: string }) {
  // viewBox is the artwork cropped to the letters: 2482 × 1504.
  return (
    <Svg width={size} height={(size * 1504) / 2482} viewBox="259 748 2482 1504" accessibilityLabel="Nelly & Nova">
      <Path fill={color} d="M259 748 L453 748 L453 1963.9 L1203.5 748 L1444 748 L1444 2252 L1249 2252 L1249 1038.5 L488 2252 L259 2252 Z" />
      <Path fill={color} d="M2741 748 L2547 748 L2547 1963.9 L1796.5 748 L1556 748 L1556 2252 L1751 2252 L1751 1038.5 L2512 2252 L2741 2252 Z" />
    </Svg>
  );
}
