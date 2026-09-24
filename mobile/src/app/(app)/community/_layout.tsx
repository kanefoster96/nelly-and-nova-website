import { Stack } from "expo-router";

import { tabStackOptions } from "@/components/tabStack";

export default function CommunityStack() {
  return (
    <Stack screenOptions={tabStackOptions}>
      <Stack.Screen name="index" options={{ title: "Community" }} />
    </Stack>
  );
}
