import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { AuthScreen } from "@/components/auth-screen";
import { ErrorText, FieldLabel, LinkButton, PrimaryButton, TextField } from "@/components/ui";
import { signInWithPassword } from "@/lib/auth-flow";
import { colors } from "@/theme";

/** Log in, step two, for an address that has an account. "Forgot password?" emails a button. */
export default function PasswordScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const email = typeof emailParam === "string" ? emailParam : "";
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (loading || !password) return;
    setError(null);
    setLoading(true);
    const problem = await signInWithPassword(email, password);
    setLoading(false);
    if (problem) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(problem);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    // The root layout's auth gate moves them on once the session lands.
  }

  return (
    <AuthScreen
      title="Welcome back"
      subtitle={
        <>
          {email}
          {"  "}
          <Text style={{ color: colors.foreground, fontWeight: "600" }} onPress={() => router.back()}>
            Change
          </Text>
        </>
      }
    >
      <ErrorText>{error}</ErrorText>
      {/* The email again as an invisible username field, so iOS Password AutoFill offers the saved password. */}
      <TextInput
        value={email}
        editable
        textContentType="username"
        autoComplete="username"
        importantForAutofill="yes"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={{ position: "absolute", width: 1, height: 1, opacity: 0.01, top: 0, left: 0 }}
      />
      <FieldLabel>Password</FieldLabel>
      <View>
        <TextField
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!show}
          textContentType="password"
          autoComplete="current-password"
          autoFocus
          returnKeyType="go"
          onSubmitEditing={handleLogin}
        />
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setShow((v) => !v);
          }}
          hitSlop={8}
          accessibilityLabel={show ? "Hide password" : "Show password"}
          style={{ position: "absolute", right: 14, top: 0, bottom: 16, justifyContent: "center" }}
        >
          <Text style={{ color: colors.muted, fontSize: 15 }}>{show ? "Hide" : "Show"}</Text>
        </Pressable>
      </View>
      <PrimaryButton title="Log In" onPress={handleLogin} loading={loading} disabled={!password} />
      <View style={{ marginTop: 20, alignItems: "center" }}>
        <LinkButton title="Forgot password?" onPress={() => router.push({ pathname: "/check-email", params: { email, mode: "reset" } })} />
      </View>
    </AuthScreen>
  );
}
