import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TopBar } from "@/components/top-bar";
import { colors } from "@/theme";

type IoniconName = keyof typeof Ionicons.glyphMap;

function TabIcon({ name, focused, color }: { name: IoniconName; focused: boolean; color: ColorValue }) {
  return <Ionicons name={focused ? name : (`${name}-outline` as IoniconName)} size={24} color={color} />;
}

/**
 * Same shell as the Kanvas app: the top bar (avatar → Profile, bell →
 * Notifications) fixed above four tabs. Members and trainers share the tabs;
 * each screen shows the right side for the signed-in role.
 */
export default function TabsLayout() {
  // Lift the bar clear of the iPhone home indicator.
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 6);

  return (
    <Tabs
      screenOptions={{
        header: () => <TopBar />,
        tabBarActiveTintColor: colors.foreground,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 58 + bottomPadding,
          paddingBottom: bottomPadding,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="community" options={{ title: "Community", tabBarIcon: ({ focused, color }) => <TabIcon name="home" focused={focused} color={color} /> }} />
      <Tabs.Screen name="homework" options={{ title: "Homework", tabBarIcon: ({ focused, color }) => <TabIcon name="school" focused={focused} color={color} /> }} />
      <Tabs.Screen name="schedule" options={{ title: "Schedule", tabBarIcon: ({ focused, color }) => <TabIcon name="calendar" focused={focused} color={color} /> }} />
      <Tabs.Screen name="chat" options={{ title: "Chat", tabBarIcon: ({ focused, color }) => <TabIcon name="chatbubble-ellipses" focused={focused} color={color} /> }} />
    </Tabs>
  );
}
