import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";

type IconName = keyof typeof Ionicons.glyphMap;

/** Stub for a tab whose real content hasn't been built yet. */
export function PlaceholderScreen({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <View style={styles.wrapper}>
      <Ionicons name={icon} size={40} color={colors.paperDim} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 10,
    backgroundColor: colors.ink,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.paper,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.paperDim,
    textAlign: "center",
  },
});
