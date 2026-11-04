import { ScrollView, Text } from "react-native";

import { Pressable } from "@/components/pressable";
import { hapticSelection } from "@/lib/haptics";
import { colors } from "@/theme";

/**
 * A sideways row of pills to pick one from — dates, times, weekdays — in
 * place of a date picker (which would need a native module). The chosen
 * one is solid, as add-dog's 1-1 times are.
 */
export function ChipRow<T extends string>({ options, value, onChange }: { options: { value: T; label: string; disabled?: boolean }[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }} keyboardShouldPersistTaps="handled">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              hapticSelection();
              onChange(o.value);
            }}
            disabled={o.disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: on, disabled: !!o.disabled }}
            style={{
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 9,
              borderWidth: 1,
              borderColor: on ? colors.accent : colors.border,
              backgroundColor: on ? colors.accent : "transparent",
              opacity: o.disabled ? 0.35 : 1,
            }}
          >
            <Text style={{ color: on ? colors.accentForeground : colors.foreground, fontSize: 14, fontWeight: "700" }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
