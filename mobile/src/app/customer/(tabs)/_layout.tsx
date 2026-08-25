import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { View } from "react-native";
import { TopBar } from "@/components/TopBar";
import { colors } from "@/theme/colors";

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; label: string; icon: IconName; iconFocused: IconName }[] = [
  { name: "index", label: "Home", icon: "home-outline", iconFocused: "home" },
  { name: "sessions", label: "Sessions", icon: "calendar-outline", iconFocused: "calendar" },
  { name: "reports", label: "Reports", icon: "document-text-outline", iconFocused: "document-text" },
  { name: "community", label: "Community", icon: "people-outline", iconFocused: "people" },
  { name: "messages", label: "Messages", icon: "chatbubble-outline", iconFocused: "chatbubble" },
];

/**
 * The customer app shell — a 5-item bottom tab bar (Instagram-style) under a
 * shared top bar (account avatar top-left, notifications bell top-right).
 * Auth/membership is guarded one level up, in customer/_layout.tsx.
 */
export default function CustomerTabsLayout() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <TopBar
        title="Nelly & Nova"
        onAvatarPress={() => router.push("/customer/profile")}
        onBellPress={() => {
          // TODO: notifications screen once notifications are wired up.
        }}
      />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.paper,
          tabBarInactiveTintColor: colors.paperDim,
          tabBarStyle: {
            backgroundColor: colors.ink,
            borderTopColor: colors.border,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        }}
      >
        {TABS.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.label,
              tabBarIcon: ({ focused, color, size }) => (
                <Ionicons name={focused ? tab.iconFocused : tab.icon} size={size} color={color} />
              ),
            }}
          />
        ))}
      </Tabs>
    </View>
  );
}
