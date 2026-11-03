import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { FormScrollView } from "@/components/ui";
import { colors } from "@/theme";

/** The log-in steps after the email screen: back button, title, subtitle, then the form. */
export function AuthScreen({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <FormScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 24, paddingTop: 64, paddingBottom: 48 }}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          if (router.canGoBack()) router.back();
          else router.replace("/sign-in");
        }}
        hitSlop={10}
        accessibilityLabel="Back"
        style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", marginBottom: 28 }}
      >
        <Ionicons name="chevron-back" size={22} color={colors.foreground} />
      </Pressable>
      <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: "700" }}>{title}</Text>
      {subtitle ? <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 28 }}>{subtitle}</Text> : <View style={{ height: 24 }} />}
      {children}
    </FormScrollView>
  );
}
