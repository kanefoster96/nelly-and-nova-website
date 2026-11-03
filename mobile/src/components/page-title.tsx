import type { ReactNode } from "react";
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import { colors } from "@/theme";

/**
 * The app's page title: big and bold at the top left, as the Kanvas app has
 * it. Every tab page starts with one, and every page pushed on top gets one
 * under its back button (components/screen-header.tsx), so the whole app
 * reads the same way. No side padding of its own: it sits in the page's.
 */
const TITLE_LINE = 36;
export const PAGE_TITLE_STYLE: TextStyle = { color: colors.foreground, fontSize: 30, fontWeight: "800", letterSpacing: -0.5, lineHeight: TITLE_LINE };

export function PageTitle({
  title,
  note,
  noteColor,
  subtitle,
  right,
  style,
}: {
  title: string;
  /** A short word beside the title: "3 unread". */
  note?: string | null;
  noteColor?: string;
  /** A line under the title saying what the page is for. */
  subtitle?: string | null;
  /** A button or two at the right, level with the title. */
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 10 }}>
          <Text accessibilityRole="header" numberOfLines={2} style={[PAGE_TITLE_STYLE, { flexShrink: 1 }]}>
            {title}
          </Text>
          {!!note && <Text style={{ color: noteColor ?? colors.muted, fontSize: 14, fontWeight: "700" }}>{note}</Text>}
        </View>
        {/* The 44pt round buttons spill over the title's line rather than make the row taller, so every title sits level. */}
        {right ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6, height: TITLE_LINE }}>{right}</View> : null}
      </View>
      {!!subtitle && <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21, marginTop: 4 }}>{subtitle}</Text>}
    </View>
  );
}
