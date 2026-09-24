import * as Linking from "expo-linking";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { BuildInfo } from "@/components/build-info";
import { Logo } from "@/components/logo";
import { ErrorText, FieldLabel, FormScrollView, LinkButton, PrimaryButton, TextField } from "@/components/ui";
import { config, isSupabaseConfigured } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme";

const MEMBERSHIP_URL = "https://www.nellyandnova.co.uk";

/**
 * The app's front door, laid out like the Kanvas app's login. Members only —
 * accounts are made on the website, so anyone new is sent there.
 */
export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    isSupabaseConfigured ? null : "The app isn't connected to Supabase yet (EXPO_PUBLIC_SUPABASE_* missing)."
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setNotice(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message === "Invalid login credentials" ? "That email and password don't match a member account." : signInError.message);
    }
    // The root layout's auth gate takes it from here once the session lands.
  }

  async function handleForgot() {
    setNotice(null);
    if (!email.trim()) {
      setError("Enter your email above, then tap “Forgot password?”.");
      return;
    }
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: new URL("/login", config.siteUrl).toString(),
    });
    if (resetError) setError(resetError.message);
    else setNotice("Check your inbox for a link to reset your password.");
  }

  return (
    <FormScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 24, paddingTop: 72, paddingBottom: 48 }}>
      <View style={{ alignItems: "center" }}>
        <Logo size={96} />
        <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "600", marginTop: 28, textAlign: "center" }}>Member Log In</Text>
        <Text style={{ color: colors.muted, fontSize: 15, marginTop: 8, marginBottom: 32, textAlign: "center", lineHeight: 21 }}>
          Your community, homework, schedule and chat with the team — all in one place.
        </Text>
      </View>

      <ErrorText>{error}</ErrorText>
      {notice && <Text style={{ color: colors.success, fontSize: 14, marginBottom: 12 }}>{notice}</Text>}

      <FieldLabel>Email</FieldLabel>
      <TextField value={email} onChangeText={setEmail} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" placeholder="you@example.com" />

      <FieldLabel>Password</FieldLabel>
      <TextField
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
        autoComplete="current-password"
        placeholder="••••••••"
        returnKeyType="go"
        onSubmitEditing={handleLogin}
      />

      <PrimaryButton title="Log In" onPress={handleLogin} loading={loading} disabled={!isSupabaseConfigured || !email || !password} />

      <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 12, lineHeight: 17 }}>
        By logging in you agree to our{" "}
        <Text style={{ color: colors.foreground, textDecorationLine: "underline" }} onPress={() => Linking.openURL(new URL("/terms", config.siteUrl).toString())}>
          Terms
        </Text>{" "}
        and{" "}
        <Text style={{ color: colors.foreground, textDecorationLine: "underline" }} onPress={() => Linking.openURL(new URL("/privacy", config.siteUrl).toString())}>
          Privacy Policy
        </Text>
        .
      </Text>

      <View style={{ marginTop: 16, alignItems: "center" }}>
        <LinkButton title="Forgot password?" onPress={handleForgot} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 36, marginBottom: 24 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text style={{ color: colors.muted, fontSize: 12, letterSpacing: 1 }}>OR</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>

      <Pressable
        onPress={() => Linking.openURL(MEMBERSHIP_URL)}
        style={({ pressed }) => [
          { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 18, alignItems: "center" },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}>Become a Member</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4, textAlign: "center", lineHeight: 18 }}>
          New to Nelly &amp; Nova? Book a meet &amp; greet on our website — nellyandnova.co.uk
        </Text>
      </Pressable>

      <BuildInfo />
    </FormScrollView>
  );
}
