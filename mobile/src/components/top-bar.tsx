import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/auth/AuthProvider";
import { AvatarCircle } from "@/components/avatar-circle";
import { Logo } from "@/components/logo";
import { useNotifications } from "@/lib/notifications-context";
import { colors } from "@/theme";

/**
 * Instagram-style top bar (same as the Kanvas app): avatar on the left opens
 * Profile, the NN mark in the middle, notifications bell with an unread
 * badge on the right. Fixed above the tabs.
 */
export function TopBar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const { unread } = useNotifications();
  const name = profile?.ownerName || session?.user.email || "?";

  return (
    <View style={{ paddingTop: insets.top, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 }}>
        <Pressable onPress={() => router.push("/profile")} hitSlop={8} accessibilityLabel="Profile">
          <AvatarCircle name={name} avatarUrl={profile?.avatarUrl} size={34} />
        </Pressable>
        <Logo size={34} />
        <Pressable onPress={() => router.push("/notifications")} hitSlop={8} style={{ position: "relative" }} accessibilityLabel="Notifications">
          <Ionicons name="notifications-outline" size={26} color={colors.foreground} />
          {unread > 0 && (
            <View
              style={{
                position: "absolute",
                top: -3,
                right: -5,
                minWidth: 17,
                height: 17,
                borderRadius: 9,
                paddingHorizontal: 4,
                backgroundColor: colors.success,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1.5,
                borderColor: colors.surface,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{unread > 9 ? "9+" : unread}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}
