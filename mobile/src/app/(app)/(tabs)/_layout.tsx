import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter, useSegments } from "expo-router";
import { View } from "react-native";

import { FloatingBar, type BarTab } from "@/components/floating-bar";
import { TopBar } from "@/components/top-bar";
import { FloatingBarProvider } from "@/lib/floating-bar";
import { colors } from "@/theme";

type IoniconName = keyof typeof Ionicons.glyphMap;

function TabIcon({ name, focused, color }: { name: IoniconName; focused: boolean; color: string }) {
  return <Ionicons name={focused ? name : (`${name}-outline` as IoniconName)} size={24} color={color} />;
}

const TABS: { key: "community" | "homework" | "schedule" | "chat"; label: string; icon: IoniconName }[] = [
  { key: "community", label: "Community", icon: "home" },
  { key: "homework", label: "Homework", icon: "school" },
  { key: "schedule", label: "Schedule", icon: "calendar" },
  { key: "chat", label: "Chat", icon: "chatbubble-ellipses" },
];

/**
 * The same shell as the Kanvas app: the floating top buttons (avatar →
 * Profile, the NN mark, bell → Notifications) over four tabs, with the
 * floating glass bar along the bottom in place of the navigator's own
 * (components/floating-bar.tsx). Each page runs full height behind both.
 * Members and trainers share the tabs; each screen shows the right side
 * for the signed-in role. Profile, Notifications, a conversation and a
 * drill push on top of all this (app/(app)/_layout.tsx).
 */
export default function TabsLayout() {
  const router = useRouter();
  const segments = useSegments() as string[];
  // ["(app)", "(tabs)", "schedule"]
  const activeKey = segments[2] ?? "community";

  const tabs: BarTab[] = TABS.map((t) => ({
    key: t.key,
    label: t.label,
    icon: (focused, color) => <TabIcon name={t.icon} focused={focused} color={color} />,
    onPress: () => router.navigate(`/${t.key}`),
  }));

  return (
    <FloatingBarProvider>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Tabs
          tabBar={() => null}
          screenOptions={{
            header: () => <TopBar />,
            // The top buttons float over the page (components/top-bar.tsx): it runs up behind them.
            headerTransparent: true,
            sceneStyle: { backgroundColor: colors.background },
          }}
        >
          {TABS.map((t) => (
            <Tabs.Screen key={t.key} name={t.key} options={{ title: t.label }} />
          ))}
        </Tabs>
        <FloatingBar tabs={tabs} activeKey={activeKey} />
      </View>
    </FloatingBarProvider>
  );
}
