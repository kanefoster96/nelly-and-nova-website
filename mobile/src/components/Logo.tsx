import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";

type LogoProps = {
  size?: number;
};

/**
 * PLACEHOLDER logo mark. Swap this for the real Nelly & Nova logo once it's
 * ready — drop the asset in `mobile/assets/images/` and replace the <View>
 * below with an <Image source={require(...)} />. Keeping it as a component
 * means every screen picks up the real logo automatically once it lands.
 */
export function Logo({ size = 88 }: LogoProps) {
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.mark, { fontSize: size * 0.36 }]}>N&N</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.inkRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mark: {
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.paper,
  },
});
