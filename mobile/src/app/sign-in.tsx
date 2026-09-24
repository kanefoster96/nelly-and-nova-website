import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Logo } from "@/components/Logo";
import { config, isSupabaseConfigured } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { colors, radius, space } from "@/theme";

const MEMBERSHIP_URL = "https://www.nellyandnova.co.uk";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    if (!email || !password) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(error.message === "Invalid login credentials" ? "That email and password don't match a member account." : error.message);
      return;
    }
    // AuthProvider picks up the new session and the root stack swaps to the app.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function resetPassword() {
    if (!email) {
      setError("Enter your email above, then tap “Forgot password?”.");
      return;
    }
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: new URL("/login", config.siteUrl).toString(),
    });
    if (error) setError(error.message);
    else setNotice("Check your inbox for a link to reset your password.");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Logo size={120} />
            <Text style={styles.title}>Members sign in</Text>
            <Text style={styles.subtitle}>Community, homework, your schedule and chat with your trainer.</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.paperDim}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              returnKeyType="next"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.paperDim}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={signIn}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            {!isSupabaseConfigured ? (
              <Text style={styles.error}>App isn't connected to Supabase yet (EXPO_PUBLIC_SUPABASE_* missing).</Text>
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.primary, (pressed || busy) && styles.pressed]}
              onPress={signIn}
              disabled={busy || !isSupabaseConfigured}
            >
              {busy ? <ActivityIndicator color={colors.accentInk} /> : <Text style={styles.primaryText}>Sign in</Text>}
            </Pressable>
            <Pressable onPress={resetPassword} hitSlop={8}>
              <Text style={styles.link}>Forgot password?</Text>
            </Pressable>
          </View>

          <View style={styles.join}>
            <Text style={styles.joinText}>Not a member yet?</Text>
            <Pressable
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              onPress={() => Linking.openURL(MEMBERSHIP_URL)}
            >
              <Text style={styles.secondaryText}>Visit nellyandnova.co.uk</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: space.lg, gap: space.xl, justifyContent: "center" },
  brand: { alignItems: "center", gap: space.sm },
  title: { color: colors.paper, fontSize: 28, fontWeight: "800", marginTop: space.sm },
  subtitle: { color: colors.paperDim, fontSize: 15, textAlign: "center", lineHeight: 21 },
  form: { gap: space.md },
  input: {
    backgroundColor: colors.inkRaised,
    color: colors.paper,
    borderRadius: radius.md,
    borderCurve: "continuous",
    paddingHorizontal: space.md,
    paddingVertical: 15,
    fontSize: 17,
  },
  error: { color: "#ff8a80", fontSize: 14 },
  notice: { color: colors.paper, fontSize: 14 },
  primary: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: 15, alignItems: "center" },
  primaryText: { color: colors.accentInk, fontSize: 17, fontWeight: "700" },
  pressed: { opacity: 0.7 },
  link: { color: colors.paperDim, textAlign: "center", fontSize: 15 },
  join: { gap: space.sm, alignItems: "stretch" },
  joinText: { color: colors.paperDim, textAlign: "center", fontSize: 15 },
  secondary: { borderRadius: radius.pill, paddingVertical: 15, alignItems: "center", borderWidth: 1, borderColor: colors.line },
  secondaryText: { color: colors.paper, fontSize: 17, fontWeight: "600" },
});
