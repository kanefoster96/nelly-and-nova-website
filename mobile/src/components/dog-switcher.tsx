import { Text, View } from "react-native";

import { Pressable } from "@/components/pressable";
import { hapticSelection } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { colors, GLASS_BORDER } from "@/theme";

/** The dog switcher at the top of the Profile and Homework tabs, as Kanvas switches dancers. */
export function DogSwitcher({ dogs, selected, onSelect, style }: { dogs: { id: string; name: string }[]; selected: string; onSelect: (id: string) => void; style?: object }) {
  return (
    <View accessibilityRole="tablist" style={[{ flexDirection: "row", borderRadius: 999, borderWidth: 1, ...GLASS_BORDER, backgroundColor: colors.surface, padding: 4, marginBottom: 20 }, style]}>
      {dogs.map((d) => {
        const on = d.id === selected;
        return (
          <Pressable
            key={d.id}
            onPress={() => {
              if (on) return;
              hapticSelection();
              animateListChange();
              onSelect(d.id);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 999, alignItems: "center", backgroundColor: on ? colors.foreground : "transparent" }}
          >
            <Text numberOfLines={1} style={{ color: on ? colors.background : colors.muted, fontSize: 14, fontWeight: on ? "700" : "600" }}>
              {d.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
