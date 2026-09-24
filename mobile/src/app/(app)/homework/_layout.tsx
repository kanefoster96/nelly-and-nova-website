import { Stack } from "expo-router";

import { tabStackOptions } from "@/components/tabStack";

export default function HomeworkStack() {
  return (
    <Stack screenOptions={tabStackOptions}>
      <Stack.Screen name="index" options={{ title: "Homework" }} />
      <Stack.Screen name="drill/[id]" options={{ title: "", headerLargeTitle: false }} />
    </Stack>
  );
}
