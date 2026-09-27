import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { colors, pressedBg } from "@/theme";

/** A tappable settings-style row: icon, title, optional description and badge. */
export function NavRow({
  icon,
  title,
  description,
  badge,
  onPress,
  leading,
}: {
  icon?: ComponentProps<typeof Ionicons>["name"];
  title: string;
  description?: string;
  badge?: number;
  onPress?: () => void;
  /** Replaces the icon circle, e.g. with an avatar. */
  leading?: ReactNode;
}) {
  const content = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
      {leading ?? (
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(245,245,242,0.06)", alignItems: "center", justifyContent: "center" }}>
          {icon && <Ionicons name={icon} size={18} color={colors.muted} />}
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "500" }}>{title}</Text>
          {!!badge && (
            <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }}>
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>{badge}</Text>
            </View>
          )}
        </View>
        {description && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{description}</Text>}
      </View>
    </View>
  );
  const rowStyle = { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingVertical: 14 } as const;

  if (!onPress) return <View style={rowStyle}>{content}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [rowStyle, pressed && { backgroundColor: pressedBg }]}>
      {content}
      <Text style={{ color: colors.muted }}>{"→"}</Text>
    </Pressable>
  );
}

/** Full-width list of rows, iOS-settings style, edge to edge with hairlines. */
export function NavList({ children }: { children: ReactNode }) {
  return <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>{children}</View>;
}

export function NavDivider() {
  return <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 62 }} />;
}
