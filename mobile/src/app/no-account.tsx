import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { AuthScreen } from "@/components/auth-screen";
import { PrimaryButton } from "@/components/ui";
import { config } from "@/lib/config";
import { colors } from "@/theme";

/**
 * An address with no account and no meet & greet request. New owners start
 * with a free meet & greet (the form on the website). Someone who asked
 * with a different email, or before accounts existed, can set one up here.
 */
export default function NoAccountScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const email = typeof emailParam === "string" ? emailParam : "";
  return (
    <AuthScreen
      title="No account yet"
      subtitle={`We couldn't find an account for ${email}. New owners start with a free meet & greet — tell us about your dog and we'll be in touch.`}
    >
      <View style={{ gap: 12 }}>
        <PrimaryButton title="Book a Free Meet & Greet" onPress={() => Linking.openURL(new URL("/book", config.siteUrl).toString())} />
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            { borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, paddingVertical: 14, alignItems: "center" },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "500" }}>Try a Different Email</Text>
        </Pressable>
      </View>
      <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 28 }}>
        Already asked for a meet &amp; greet?{" "}
        <Text
          style={{ color: colors.foreground, fontWeight: "600", textDecorationLine: "underline" }}
          onPress={() => router.push({ pathname: "/check-email", params: { email, mode: "setup" } })}
          accessibilityRole="link"
        >
          Set up your account
        </Text>{" "}
        with a link we&apos;ll email you.
      </Text>
    </AuthScreen>
  );
}
