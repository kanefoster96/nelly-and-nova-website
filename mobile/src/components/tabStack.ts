import type { NativeStackNavigationOptions } from "expo-router/native-stack";

import { colors } from "@/theme";

/** Native large-title header used by every tab's stack. */
export const tabStackOptions: NativeStackNavigationOptions = {
  headerLargeTitle: true,
  headerLargeTitleShadowVisible: false,
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.ink },
  headerTintColor: colors.paper,
  headerTitleStyle: { color: colors.paper },
  headerLargeTitleStyle: { color: colors.paper },
  contentStyle: { backgroundColor: colors.ink },
};
