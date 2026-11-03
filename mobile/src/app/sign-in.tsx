import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { BuildInfo } from "@/components/build-info";
import { Logo } from "@/components/logo";
import { ErrorText, FieldLabel, FormScrollView, PrimaryButton, TextField } from "@/components/ui";
import { EMAIL_RE, lookupAccount } from "@/lib/auth-flow";
import { config, isSupabaseConfigured } from "@/lib/config";
import { colors } from "@/theme";

/**
 * The app's front door, email first (like Kanvas Academy's app 1.1): one box,
 * then whichever screen fits that address —
 *   - it has an account → password
 *   - no account, but they've asked for a meet & greet → "Check your email"
 *     (a button to set up their account)
 *   - neither → "No account yet": ask for a free meet & greet
 * `email` arrives filled in when another screen sends someone back here.
 */
export default function SignInScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [error, setError] = useState<string | null>(
    isSupabaseConfigured ? null : "The app isn't connected to Supabase yet (EXPO_PUBLIC_SUPABASE_* missing)."
  );
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    const trimmed = email.trim();
    if (loading) return;
    if (!EMAIL_RE.test(trimmed)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setError("Please enter your email address.");
      return;
    }
    setError(null);
    setLoading(true);
    const found = await lookupAccount(trimmed);
    setLoading(false);
    if (!found.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(found.message);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (found.account) router.push({ pathname: "/password", params: { email: trimmed } });
    else if (found.known) router.push({ pathname: "/check-email", params: { email: trimmed, mode: "setup" } });
    else router.push({ pathname: "/no-account", params: { email: trimmed } });
  }

  return (
    <FormScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 96, paddingBottom: 32 }}>
      <View style={{ alignItems: "center", marginBottom: 36 }}>
        <Logo size={96} />
        <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: "700", marginTop: 24, textAlign: "center" }}>Log in to Nelly &amp; Nova</Text>
      </View>

      <ErrorText>{error}</ErrorText>

      <FieldLabel>Email</FieldLabel>
      <TextField
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        // "username" so iOS offers saved Nelly & Nova logins here and fills the password next.
        textContentType="username"
        autoComplete="username"
        placeholder="you@example.com"
        returnKeyType="go"
        onSubmitEditing={handleContinue}
      />

      <PrimaryButton title="Continue" onPress={handleContinue} loading={loading} />

      <Text style={{ color: colors.muted, fontSize: 15, textAlign: "center", marginTop: 20 }}>
        New here?{" "}
        <Text
          style={{ color: colors.foreground, fontWeight: "600", textDecorationLine: "underline" }}
          onPress={() => Linking.openURL(new URL("/book", config.siteUrl).toString())}
          accessibilityRole="link"
        >
          Book a free meet &amp; greet
        </Text>
      </Text>

      <View style={{ flex: 1, minHeight: 48 }} />

      <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", lineHeight: 17 }}>
        By continuing you agree to our{" "}
        <Text style={{ color: colors.foreground, textDecorationLine: "underline" }} onPress={() => Linking.openURL(new URL("/terms", config.siteUrl).toString())}>
          Terms
        </Text>{" "}
        and{" "}
        <Text style={{ color: colors.foreground, textDecorationLine: "underline" }} onPress={() => Linking.openURL(new URL("/privacy", config.siteUrl).toString())}>
          Privacy Policy
        </Text>
        .
      </Text>
      <BuildInfo />
    </FormScrollView>
  );
}
