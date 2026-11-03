import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";

import { AuthScreen } from "@/components/auth-screen";
import { ErrorText, FieldLabel, PrimaryButton, TextField } from "@/components/ui";
import { passwordProblem, setPasswordWithTicket, signInWithPassword } from "@/lib/auth-flow";
import { colors } from "@/theme";

/**
 * The last step of a forgotten password, or of setting up an account for
 * someone who asked for a meet & greet: a password typed twice, then
 * straight in. Opened by the emailed button (+native-intent.tsx) with its
 * one-use ticket. A new account (`account` "0") is asked for their name too.
 */
export default function CreatePasswordScreen() {
  const params = useLocalSearchParams<{ email?: string; ticket?: string; account?: string }>();
  const email = typeof params.email === "string" ? params.email : "";
  const ticket = typeof params.ticket === "string" ? params.ticket : "";
  const isNew = params.account === "0";
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const hint = password ? passwordProblem(password, confirm) : null;
  const ready = !passwordProblem(password, confirm) && password === confirm && (!isNew || name.trim().length > 0);

  async function save() {
    if (saving || !ready) return;
    setSaving(true);
    setError(null);
    const result = await setPasswordWithTicket({ email, ticket, password, name: isNew ? name.trim() : undefined });
    if (!result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(result.message);
      setSaving(false);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const problem = await signInWithPassword(email, password);
    if (problem) {
      setSaving(false);
      router.replace({ pathname: "/password", params: { email } });
    }
    // Signed in: the auth gate takes them into the app.
  }

  if (!email || !ticket) {
    return (
      <AuthScreen title="That link didn't work" subtitle="Go back to log in and we'll send you a new one.">
        <PrimaryButton title="Back to Log In" onPress={() => router.replace("/sign-in")} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title={isNew ? "Set up your account" : "Create a password"} subtitle={`You'll use it with ${email} to log in to the app and the website.`}>
      <ErrorText>{error}</ErrorText>
      {isNew && (
        <>
          <FieldLabel>Your name</FieldLabel>
          <TextField value={name} onChangeText={setName} autoCapitalize="words" textContentType="name" autoComplete="name" />
        </>
      )}
      <FieldLabel>New password</FieldLabel>
      <TextField value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" autoComplete="new-password" />
      <FieldLabel>Type it again</FieldLabel>
      <TextField value={confirm} onChangeText={setConfirm} secureTextEntry textContentType="newPassword" autoComplete="new-password" returnKeyType="go" onSubmitEditing={save} />
      {hint ? <Text style={{ color: colors.muted, fontSize: 13, marginTop: -6, marginBottom: 14 }}>{hint}</Text> : null}
      <PrimaryButton title="Save and Log In" onPress={save} loading={saving} disabled={!ready} />
    </AuthScreen>
  );
}
