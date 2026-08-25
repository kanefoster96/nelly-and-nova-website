import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { hasActiveMembership, useAuthStatus, useSession } from "@/lib/session";
import { colors } from "@/theme/colors";

/**
 * App entry point — routes by auth + role, same split as the website:
 *   - signed out              → /login
 *   - role "admin"            → /admin
 *   - role "member" + a dog   → /customer (the customer app)
 *   - role "member", no dog   → /pending (no active membership yet)
 */
export default function Index() {
  const status = useAuthStatus();
  const session = useSession();

  if (status === "loading") {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (status === "anon" || !session) {
    return <Redirect href="/login" />;
  }

  if (session.role === "admin") {
    return <Redirect href="/admin" />;
  }

  if (hasActiveMembership(session)) {
    return <Redirect href="/customer" />;
  }

  return <Redirect href="/pending" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink,
  },
});
