import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewProps,
  type TextInputProps,
} from "react-native";

import { colors } from "@/theme";

export function ScreenContainer({ children }: { children: ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

/** ScrollView for screens full of inputs — pads for the keyboard natively. */
export function FormScrollView(props: ScrollViewProps) {
  return <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" {...props} />;
}

export function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function TextField(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.muted} style={styles.input} autoCapitalize="none" autoCorrect={false} {...props} />;
}

export function PrimaryButton({ title, onPress, loading, disabled }: { title: string; onPress: () => void; loading?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.primaryButton, (disabled || loading) && styles.buttonDisabled, pressed && styles.buttonPressed]}
    >
      {loading ? <ActivityIndicator color={colors.accentForeground} /> : <Text style={styles.primaryButtonText}>{title}</Text>}
    </Pressable>
  );
}

export function LinkButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text style={styles.linkText}>{title}</Text>
    </Pressable>
  );
}

export function ErrorText({ children }: { children: string | null }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

/** Small uppercase section label above a list or card. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

/** Full-screen spinner / error placeholder. */
export function LoadingState({ error }: { error?: string | null }) {
  return (
    <View style={styles.center}>
      {error ? <Text style={{ color: colors.danger, textAlign: "center" }}>{error}</Text> : <ActivityIndicator color={colors.foreground} />}
    </View>
  );
}

/** Rounded pill tag — "OFFICIAL", "PINNED", "HELD"… */
export function Tag({ label, solid = false, tone }: { label: string; solid?: boolean; tone?: string }) {
  return (
    <View
      style={[
        styles.tag,
        solid ? { backgroundColor: tone ?? colors.foreground, borderColor: tone ?? colors.foreground } : tone ? { borderColor: tone } : null,
      ]}
    >
      <Text style={[styles.tagText, solid ? { color: colors.background } : tone ? { color: tone } : null]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 24, paddingTop: 24 },
  label: { color: colors.muted, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.foreground,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: colors.surface,
  },
  primaryButton: { backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  buttonPressed: { opacity: 0.75 },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: colors.accentForeground, fontSize: 16, fontWeight: "600" },
  linkText: { color: colors.foreground, textDecorationLine: "underline", fontSize: 14 },
  error: { color: colors.danger, fontSize: 14, marginBottom: 12 },
  section: { color: colors.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginTop: 24, marginBottom: 8 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 32 },
  tag: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1.5 },
  tagText: { color: colors.muted, fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
});
