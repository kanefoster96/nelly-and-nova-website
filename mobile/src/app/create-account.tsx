import { useState } from "react";
import { Link, useRouter } from "expo-router";
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

type Errors = Partial<Record<"ownerName" | "email" | "password" | "confirm", string>>;

export default function CreateAccountScreen() {
  const router = useRouter();
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting">("idle");

  async function submit() {
    const nextErrors: Errors = {};
    if (!ownerName.trim()) nextErrors.ownerName = "Enter your name.";
    if (!EMAIL_RE.test(email)) nextErrors.email = "Enter a valid email address.";
    if (password.length < 8) nextErrors.password = "Use at least 8 characters.";
    if (confirm !== password) nextErrors.confirm = "Passwords don't match.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setFormError(null);
    setStatus("submitting");

    // Dog details ride along later in onboarding, same as the website's
    // sign-up flow (see lib/auth/session.ts → signUpNewAccount).
    const { error, data } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { owner_name: ownerName.trim() } },
    });

    setStatus("idle");
    if (error) {
      setFormError(error.message);
      return;
    }

    if (!data.session) {
      setFormError(null);
      router.replace({
        pathname: "/login",
        params: { justSignedUp: "1" },
      });
      return;
    }

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

          <Text style={styles.eyebrow}>Join us</Text>
          <Text style={styles.heading}>Create an account.</Text>
          <Text style={styles.subtitle}>
            Set up your account to book sessions, track training and chat
            with us directly.
          </Text>

          <View style={styles.card}>
            <View style={styles.form}>
              <TextField
                label="Your name"
                value={ownerName}
                onChangeText={setOwnerName}
                error={errors.ownerName}
                placeholder="Charlotte Smith"
                autoComplete="name"
                textContentType="name"
              />
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
                textContentType="newPassword"
                autoComplete="password-new"
              />
              <TextField
                label="Confirm password"
                value={confirm}
                onChangeText={setConfirm}
                error={errors.confirm}
                secureTextEntry
                textContentType="newPassword"
                autoComplete="password-new"
              />

              {formError ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>{formError}</Text>
                </View>
              ) : null}

              <Button
                title={status === "submitting" ? "Creating account…" : "Create account"}
                onPress={submit}
                loading={status === "submitting"}
              />
            </View>
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/login" asChild>
              <Text style={styles.footerLink}>Log in</Text>
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
    fontSize: 32,
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
