import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Tag } from "@/components/ui";
import { colors } from "@/theme";

/** "Thursday 21 August" heading, then the day's cards — the Kanvas calendar layout. */
export function DayGroup({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>{heading}</Text>
      {children}
    </View>
  );
}

export function SessionCard({
  title,
  detail,
  tag,
  highlight = false,
  children,
}: {
  title: string;
  detail?: string;
  tag?: string;
  /** The next session — a green edge, like Kanvas' extra-session cards. */
  highlight?: boolean;
  children?: ReactNode;
}) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: highlight ? "rgba(34,197,94,0.4)" : colors.border,
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="paw-outline" size={15} color={highlight ? colors.success : colors.muted} />
        <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", flex: 1 }}>{title}</Text>
        {tag && <Tag label={tag} tone={highlight ? colors.success : undefined} />}
      </View>
      {detail && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>{detail}</Text>}
      {children}
    </View>
  );
}
