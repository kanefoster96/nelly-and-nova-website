import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassButton } from "@/components/glass-button";
import { PageTitle } from "@/components/page-title";
import { colors } from "@/theme";

/**
 * The top of a page pushed over the tabs (Profile, Notifications, a drill),
 * as the Kanvas app has it: a round glass back button at the top left, any
 * actions top right, then the page's name big and bold underneath, as every
 * tab page starts (components/page-title.tsx). Without a history to go back
 * to (a link opened it), back goes to Community. Leave the title out for a
 * page that draws its own.
 */
export function ScreenHeader({
  title,
  note,
  noteColor,
  subtitle,
  right,
  onBack,
}: {
  title?: string;
  /** A short word beside the title: "3 unread". */
  note?: string | null;
  noteColor?: string;
  /** A line under the title. */
  subtitle?: string | null;
  /** An icon button or two, top right. */
  right?: ReactNode;
  /** In place of going back. */
  onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();
  function back() {
    if (onBack) onBack();
    else if (router.canGoBack()) router.back();
    else router.replace("/community");
  }
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: colors.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, height: 60 }}>
        <GlassButton onPress={back} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.foreground} style={{ marginRight: 2 }} />
        </GlassButton>
        <View style={{ flex: 1 }} />
        {right ? <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>{right}</View> : null}
      </View>
      {!!title && <PageTitle title={title} note={note} noteColor={noteColor} subtitle={subtitle} style={{ paddingHorizontal: 20, paddingTop: 2, paddingBottom: 12 }} />}
    </View>
  );
}
