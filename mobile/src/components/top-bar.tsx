import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Animated, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/auth/AuthProvider";
import { AvatarCircle } from "@/components/avatar-circle";
import { CountBadge } from "@/components/count-badge";
import { GlassButton } from "@/components/glass-button";
import { Logo } from "@/components/logo";
import { TOP_BAR_ROW, useTopBarOffset } from "@/lib/floating-bar";
import { useNotifications } from "@/lib/notifications-context";
import { colors } from "@/theme";

/**
 * The top of every tab, as the Kanvas app (and Instagram) has it: round
 * floating glass buttons over the page — your photo on the left for
 * Profile, the bell on the right with the unread count — and the NN mark
 * between them, no bar behind. Scrolling down, they stay where they were on
 * the page and fade as it carries them off; a quick swipe up slides them
 * back in (lib/floating-bar.tsx, fed by each page's useBarScroll). Each tab
 * page starts below them (useTopBarInset).
 */
export function TopBar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const { unread } = useNotifications();
  const offset = useTopBarOffset();
  const name = profile?.ownerName || session?.user.email || "?";

  return (
    <Animated.View
      // Only the buttons take touches: the page underneath still scrolls between them.
      pointerEvents="box-none"
      style={{
        paddingTop: insets.top,
        height: insets.top + TOP_BAR_ROW,
        opacity: offset.interpolate({ inputRange: [0, 50], outputRange: [1, 0], extrapolate: "clamp" }),
        transform: [{ translateY: Animated.multiply(offset, -1) }],
      }}
    >
      <View pointerEvents="box-none" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, height: TOP_BAR_ROW }}>
        <GlassButton onPress={() => router.push("/profile")} hitSlop={6} accessibilityRole="button" accessibilityLabel="Your profile">
          <AvatarCircle name={name} avatarUrl={profile?.avatarUrl} size={36} />
        </GlassButton>
        <View pointerEvents="none">
          <Logo size={34} />
        </View>
        <GlassButton
          onPress={() => router.push("/notifications")}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={unread ? `Notifications, ${unread} new` : "Notifications"}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.foreground} />
          <CountBadge count={unread} />
        </GlassButton>
      </View>
    </Animated.View>
  );
}
