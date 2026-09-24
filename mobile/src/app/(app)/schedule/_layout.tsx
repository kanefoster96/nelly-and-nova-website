import { Stack } from "expo-router";

import { tabStackOptions } from "@/components/tabStack";

export default function ScheduleStack() {
  return (
    <Stack screenOptions={tabStackOptions}>
      <Stack.Screen name="index" options={{ title: "Schedule" }} />
    </Stack>
  );
}
