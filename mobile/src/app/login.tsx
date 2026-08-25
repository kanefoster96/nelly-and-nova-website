import { useState } from "react";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { TextField } from "@/components/TextField";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme/colors";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function LoginScreen() {
  const router = useRouter();
  const { justSignedUp } = useLocalSearchParams<{ justSignedUp?: string }>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting">("idle");

  async function submit() {
    const nextErrors: { email?: string; password?: string } = {};
    if (!EMAIL_RE.test(email)) nextErrors.email = "Enter a valid email address.";
    if (!password) nextErrors.password = "Enter your password.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setFormError(null);
    setStatus("submitting");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setStatus("idle");
      setFormError(error.message);
      return;
    }

    setStatus("idle");
    // "/" is the auth/role gate (src/app/index.tsx) — it routes to /admin,
    // /customer or /pending once the session has hydrated.
    router.replace("/");
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoRow}>
            <Logo />
          </View>

          <Text style={styles.eyebrow}>Welcome back</Text>
          <Text style={styles.heading}>Log in.</Text>
          <Text style={styles.subtitle}>
            Log in to see your dog&apos;s profile, track their training and
            chat with us directly.
          </Text>

          {justSignedUp ? (
            <View style={styles.infoBanner}>
              <Text style={styles.infoBannerText}>
                Check your email to confirm your account, then log in below.
              </Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.form}>
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                error={errors.email}
                placeholder="you@example.com"
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
              />
              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                error={errors.password}
                secureTextEntry
                textContentType="password"
                autoComplete="password"
              />

              <Link href="/forgot-password" asChild>
                <Text style={styles.forgotLink}>Forgotten password?</Text>
              </Link>

              {formError ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>{formError}</Text>
                </View>
              ) : null}

              <Button
                title={status === "submitting" ? "Logging in…" : "Log in"}
                onPress={submit}
                loading={status === "submitting"}
              />
            </View>
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>New here? </Text>
            <Link href="/create-account" asChild>
              <Text style={styles.footerLink}>Create an account</Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 4,
  },
  logoRow: {
    alignItems: "center",
    marginBottom: 24,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 3,
    textTransform: "uppercase",
    color: colors.accent,
    marginBottom: 8,
  },
  heading: {
    fontSize: 36,
    fontWeight: "700",
    color: colors.paper,
  },
  subtitle: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(245,242,234,0.8)",
  },
  card: {
    marginTop: 28,
    borderRadius: 24,
    padding: 20,
    backgroundColor: colors.fieldBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  form: {
    gap: 18,
  },
  forgotLink: {
    alignSelf: "flex-end",
    fontSize: 14,
    fontWeight: "600",
    color: colors.paperDim,
    textDecorationLine: "underline",
  },
  errorBanner: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  errorBannerText: {
    fontSize: 14,
    color: colors.danger,
  },
  infoBanner: {
    marginTop: 20,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoBannerText: {
    fontSize: 14,
    color: colors.paper,
  },
  footerRow: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "center",
  },
  footerText: {
    fontSize: 14,
    color: colors.paperDim,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.paper,
    textDecorationLine: "underline",
  },
});
