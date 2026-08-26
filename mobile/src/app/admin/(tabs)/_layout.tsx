import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { View } from "react-native";
import { TopBar } from "@/components/TopBar";
import { colors } from "@/theme/colors";

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; label: string; icon: IconName; iconFocused: IconName }[] = [
  { name: "index", label: "Dashboard", icon: "speedometer-outline", iconFocused: "speedometer" },
  { name: "home", label: "Home", icon: "home-outline", iconFocused: "home" },
  { name: "calendar", label: "Calendar", icon: "calendar-outline", iconFocused: "calendar" },
  { name: "homework", label: "Homework", icon: "book-outline", iconFocused: "book" },
  { name: "menu", label: "Menu", icon: "settings-outline", iconFocused: "settings" },
];

/**
 * The coach app shell — same Instagram-style top bar + 5-tab bottom nav
 * pattern as the customer app: Dashboard, Home (community + blast), Calendar
 * (schedule + reschedule), Homework (drill library editor), Menu (customer
 * browser + everything else backend-managed). Auth/role is guarded one level
 * up, in admin/_layout.tsx.
 */
export default function AdminTabsLayout() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <TopBar
        title="Nelly & Nova · Coach"
        onAvatarPress={() => router.push("/admin/menu")}
        onChatPress={() => router.push("/admin/messages")}
        onBellPress={() => router.push("/admin/notifications")}
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
