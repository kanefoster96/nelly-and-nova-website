import { useState } from "react";
import { Link } from "expo-router";
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

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");

  async function submit() {
    if (!EMAIL_RE.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setFormError(null);
    setStatus("submitting");

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());

    if (resetError) {
      setStatus("idle");
      setFormError(resetError.message);
      return;
    }
    setStatus("sent");
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

          <Text style={styles.eyebrow}>Forgotten password</Text>
          <Text style={styles.heading}>Reset your password.</Text>
          <Text style={styles.subtitle}>
            Enter the email on your account and we&apos;ll send you a link to
            reset your password.
          </Text>

          <View style={styles.card}>
            {status === "sent" ? (
              <View style={styles.sentState}>
                <Text style={styles.sentTitle}>Check your email</Text>
                <Text style={styles.sentBody}>
                  If an account exists for {email.trim()}, a reset link is on
                  its way.
                </Text>
              </View>
            ) : (
              <View style={styles.form}>
                <TextField
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  error={error ?? undefined}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                />

                {formError ? (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>{formError}</Text>
                  </View>
                ) : null}

                <Button
                  title={status === "submitting" ? "Sending…" : "Send reset link"}
                  onPress={submit}
                  loading={status === "submitting"}
                />
              </View>
            )}
          </View>

          <View style={styles.footerRow}>
            <Link href="/login" asChild>
              <Text style={styles.footerLink}>Back to log in</Text>
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
    fontSize: 30,
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
  sentState: {
    gap: 8,
    paddingVertical: 8,
  },
  sentTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.paper,
  },
  sentBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.paperDim,
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
  footerLink: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.paper,
    textDecorationLine: "underline",
  },
});
