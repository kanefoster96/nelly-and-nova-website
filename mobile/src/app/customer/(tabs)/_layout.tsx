import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { View } from "react-native";
import { TopBar } from "@/components/TopBar";
import { colors } from "@/theme/colors";

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; label: string; icon: IconName; iconFocused: IconName }[] = [
  { name: "index", label: "Home", icon: "home-outline", iconFocused: "home" },
  { name: "your-dog", label: "Your Dog", icon: "paw-outline", iconFocused: "paw" },
  { name: "next-session", label: "Next Session", icon: "time-outline", iconFocused: "time" },
  { name: "calendar", label: "Calendar", icon: "calendar-outline", iconFocused: "calendar" },
  { name: "homework", label: "Homework", icon: "book-outline", iconFocused: "book" },
];

/**
 * The customer app shell — a 5-item bottom tab bar (Instagram-style) under a
 * shared top bar (account avatar top-left, notifications bell top-right).
 * Auth/membership is guarded one level up, in customer/_layout.tsx.
 *
 * Simplified on purpose to these 5 (Home, Your Dog, Next Session, Calendar,
 * Homework) for a first working version — Walks and the pickup-notification
 * system were pulled back out; see the mobile README for how to reintroduce
 * them later.
 */
export default function CustomerTabsLayout() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <TopBar
        title="Nelly & Nova"
        onAvatarPress={() => router.push("/customer/your-dog")}
        onBellPress={() => {
          // TODO: notifications, once there's something real to show here again.
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
