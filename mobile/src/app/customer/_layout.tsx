import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";
import { TopBar } from "@/components/TopBar";
import { hasActiveMembership, useAuthStatus, useSession } from "@/lib/session";
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
 * Guards itself: only signed-in members with a dog on the account land here
 * (see src/app/index.tsx for the routing that gets people here in the first
 * place — this is just defence in depth against a direct deep link).
 */
export default function CustomerLayout() {
  const status = useAuthStatus();
  const session = useSession();

  if (status === "loading") return null;
  if (status === "anon" || !session) return <Redirect href="/login" />;
  if (session.role === "admin") return <Redirect href="/admin" />;
  if (!hasActiveMembership(session)) return <Redirect href="/pending" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <TopBar
        title="Nelly & Nova"
        onAvatarPress={() => {
          // TODO: account/settings screen once it exists.
        }}
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
