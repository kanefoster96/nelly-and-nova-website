import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

/**
 * The blue official tick beside a trainer's name in the community, like
 * Instagram's: a rosette with soft bumps round its edge and a white tick.
 * The same one as the Kanvas app; the website draws it too
 * (components/community/VerifiedTick.tsx).
 */

const BLUE = "#0095F6";

/** The rosette's outline in a 24×24 box: a circle with 8 soft bumps. */
const ROSETTE = (() => {
  const lobes = 8;
  const radius = 10.1;
  const bump = 1.15;
  const steps = 96;
  const points: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const r = radius + bump * Math.cos(lobes * t);
    points.push(`${(12 + r * Math.sin(t)).toFixed(2)} ${(12 - r * Math.cos(t)).toFixed(2)}`);
  }
  return `M${points.join("L")}Z`;
})();

export function VerifiedTick({ size = 15 }: { size?: number }) {
  return (
    <View accessible accessibilityLabel="Nelly & Nova trainer">
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={ROSETTE} fill={BLUE} />
        <Path d="M7.4 12.4 L10.6 15.4 L16.6 9.2" fill="none" stroke="#ffffff" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
