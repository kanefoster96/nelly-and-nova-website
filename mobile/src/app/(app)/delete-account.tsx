import { router } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";

import { ScreenHeader } from "@/components/screen-header";
import { ErrorText, PrimaryButton } from "@/components/ui";
import { config } from "@/lib/config";
import { hapticError, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme";

/**
 * Delete my account — Apple requires it in any app you can sign up through
 * (5.1.1(v)). Same as the website's /account/delete: cancels any Direct
 * Debit set up with us, then removes the account and the dogs' records.
 */
export default function DeleteAccountScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch(new URL("/api/mobile/account/delete", config.siteUrl).toString(), {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        hapticError();
        setError(body?.error ?? "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      hapticSuccess();
      await supabase.auth.signOut({ scope: "local" });
      router.replace("/sign-in");
    } catch {
      hapticError();
      setError("We couldn't reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  function confirm() {
    hapticWarning();
    Alert.alert(
      "Delete your account?",
      "Your Direct Debit will be cancelled and your dogs' records removed. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: remove },
      ]
    );
  }

  const line = (t: string) => (
    <Text key={t} style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
      • {t}
    </Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Delete account" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 48 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 15 }}>What this removes</Text>
          {line("Your login and profile.")}
          {line("Your dogs' records — details, health and vet information, documents, consent & waivers, report cards and homework.")}
          {line("Your messages, community posts and comments, and your training places.")}
        </View>
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 15 }}>Your Direct Debit</Text>
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
            Any Direct Debit set up with us is cancelled straight away, so nothing collects again. This can&apos;t be undone.
          </Text>
        </View>
        <ErrorText>{error}</ErrorText>
        <PrimaryButton title="Delete My Account" onPress={confirm} loading={busy} />
      </ScrollView>
    </View>
  );
}
