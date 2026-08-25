import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { signOut } from "@/lib/session";
import { colors } from "@/theme/colors";

/**
 * Placeholder for the admin (trainer) app. Routed here automatically for
 * profiles.role === "admin" (see src/app/index.tsx). The customer app is
 * being built first — this stub exists so admins have somewhere to land.
 */
export default function AdminHomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <Logo />
        <Text style={styles.heading}>Admin app — coming soon</Text>
        <Text style={styles.body}>
          The trainer/admin version of the app hasn&apos;t been built yet.
          The customer app is being built first.
        </Text>
        <View style={styles.action}>
          <Button title="Log out" variant="secondary" onPress={() => void signOut()} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  heading: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: "700",
    color: colors.paper,
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.paperDim,
    textAlign: "center",
  },
  action: {
    marginTop: 8,
    alignSelf: "stretch",
  },
});
