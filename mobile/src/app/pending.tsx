import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { signOut, useSession } from "@/lib/session";
import { colors } from "@/theme/colors";

/**
 * Shown to a signed-in member with no dog on their account yet — i.e. no
 * active membership to build the customer app around (see
 * hasActiveMembership in lib/session.ts). Onboarding happens on the website
 * for now; this just explains the state and offers a way out.
 */
export default function PendingScreen() {
  const session = useSession();

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <Logo />
        <Text style={styles.heading}>You&apos;re not set up yet</Text>
        <Text style={styles.body}>
          {session?.ownerName ? `Hi ${session.ownerName} — ` : ""}we
          couldn&apos;t find an active membership on this account yet. Once
          you&apos;re onboarded with us, your dog&apos;s profile will appear
          here automatically.
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
