import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { AuthScreen } from "@/components/auth-screen";
import { ErrorText, LinkButton } from "@/components/ui";
import { sendLoginLink } from "@/lib/auth-flow";
import { colors } from "@/theme";

/**
 * "Check your email": a button is emailed as the screen opens. Tapped on
 * the phone, it opens the app straight on "Create a password" with the
 * one-use ticket that proves the inbox is theirs — nothing to type. This
 * screen just waits underneath. `mode`: "setup" (no account yet) or "reset".
 */
export default function CheckEmailScreen() {
  const params = useLocalSearchParams<{ email?: string; mode?: string }>();
  const email = typeof params.email === "string" ? params.email : "";
  const mode = params.mode === "setup" ? "setup" : "reset";
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const sentOnce = useRef(false);

  useEffect(() => {
    if (sentOnce.current || !email) return;
    sentOnce.current = true;
    sendLoginLink(email).then((result) => {
      // Asked again within the minute (back, then forward): the email from a moment ago still works.
      if (!result.ok && !result.retryAfter) setError(result.message);
    });
  }, [email]);

  async function send() {
    if (sending || !email) return;
    setSending(true);
    setError(null);
    setNotice(null);
    const result = await sendLoginLink(email);
    setSending(false);
    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNotice(`We've sent it again to ${email}.`);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(result.message);
    }
  }

  const button = mode === "reset" ? "Reset My Password" : "Set Up My Account";
  return (
    <AuthScreen title="Check your email" subtitle={`We've sent an email to ${email}. Open it on this phone and tap ${button}.`}>
      <ErrorText>{error}</ErrorText>
      {notice && !error ? <Text style={{ color: colors.success, fontSize: 14, marginBottom: 12 }}>{notice}</Text> : null}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 8 }}>
        <ActivityIndicator color={colors.muted} />
        <Text style={{ color: colors.muted, fontSize: 15 }}>Waiting for you to tap it…</Text>
      </View>
      <View style={{ marginTop: 20, alignItems: "center", gap: 6 }}>
        <Text style={{ color: colors.muted, fontSize: 14 }}>Didn&apos;t get it? Check your junk folder, or</Text>
        <LinkButton title={sending ? "Sending…" : "Send it again"} onPress={send} />
      </View>
    </AuthScreen>
  );
}
