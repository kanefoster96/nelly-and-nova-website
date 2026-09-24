import { Stack } from "expo-router";

import { tabStackOptions } from "@/components/tabStack";

export default function ChatStack() {
  return (
    <Stack screenOptions={tabStackOptions}>
      <Stack.Screen name="index" options={{ title: "Chat" }} />
      <Stack.Screen name="[id]" options={{ title: "", headerLargeTitle: false }} />
    </Stack>
  );
}
