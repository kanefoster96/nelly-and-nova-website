import { Text, View } from "react-native";

import { colors } from "@/theme";

const SIZE = 18;

/**
 * The small green count on a tab or icon — unread notifications. Nothing at
 * zero. One plain green circle with the number in it, at a size that
 * doesn't follow the phone's text size. (From the Kanvas app.)
 */
export function CountBadge({ count, top = -3, right = -5 }: { count: number; top?: number; right?: number }) {
  if (count <= 0) return null;
  const label = count > 9 ? "9+" : String(count);
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top,
        right,
        height: SIZE,
        width: label.length > 1 ? SIZE + 8 : SIZE,
        borderRadius: SIZE / 2,
        backgroundColor: colors.success,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text allowFontScaling={false} numberOfLines={1} style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
        {label}
      </Text>
    </View>
  );
}
