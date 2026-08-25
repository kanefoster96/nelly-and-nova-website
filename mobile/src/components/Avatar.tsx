import { Image, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";

type AvatarProps = {
  uri?: string;
  name?: string;
  size?: number;
};

/** Round avatar — the account photo when set, else the owner's initial. */
export function Avatar({ uri, name, size = 32 }: AvatarProps) {
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return <Image source={{ uri }} style={[styles.image, dimension]} />;
  }

  const initial = name?.trim()?.[0]?.toUpperCase() ?? "?";
  return (
    <View style={[styles.fallback, dimension]}>
      <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.inkRaised,
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.inkRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  initial: {
    fontWeight: "700",
    color: colors.paper,
  },
});
