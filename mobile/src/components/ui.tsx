import { Image } from "expo-image";
import type { PropsWithChildren } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { mediaUrl } from "@/lib/media";
import { colors, radius, space } from "@/theme";

export function Card({ children, style, onPress }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; onPress?: () => void }>) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

export function Avatar({ uri, name, size = 40 }: { uri?: string | null; name: string; size?: number }) {
  const src = mediaUrl(uri);
  const dims = { width: size, height: size, borderRadius: size / 2 };
  if (src) return <Image source={src} style={[styles.avatar, dims]} contentFit="cover" transition={150} />;
  return (
    <View style={[styles.avatar, styles.initials, dims]}>
      <Text style={[styles.initialsText, { fontSize: size * 0.4 }]}>{name.trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export function Pill({ label, tone = "default" }: { label: string; tone?: "default" | "accent" | "warn" }) {
  return (
    <View style={[styles.pill, tone === "accent" && styles.pillAccent, tone === "warn" && styles.pillWarn]}>
      <Text style={[styles.pillText, tone === "accent" && styles.pillTextAccent]}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ children }: PropsWithChildren) {
  return <Text style={styles.section}>{children}</Text>;
}

export function Muted({ children }: PropsWithChildren) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.paperDim} />
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.muted}>{body}</Text> : null}
    </View>
  );
}

export function Button({ label, onPress, variant = "primary", disabled }: { label: string; onPress: () => void; variant?: "primary" | "secondary"; disabled?: boolean }) {
  const primary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, primary ? styles.buttonPrimary : styles.buttonSecondary, (pressed || disabled) && styles.pressed]}
    >
      <Text style={[styles.buttonText, primary && styles.buttonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.inkRaised,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: space.md,
    gap: space.sm,
  },
  pressed: { opacity: 0.6 },
  avatar: { backgroundColor: colors.inkSoft },
  initials: { alignItems: "center", justifyContent: "center" },
  initialsText: { color: colors.paper, fontWeight: "700" },
  pill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.inkSoft },
  pillAccent: { backgroundColor: colors.accent },
  pillWarn: { backgroundColor: "#5c4210" },
  pillText: { color: colors.paper, fontSize: 12, fontWeight: "600" },
  pillTextAccent: { color: colors.accentInk },
  section: { color: colors.paperDim, fontSize: 13, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: space.sm },
  muted: { color: colors.paperDim, fontSize: 14, lineHeight: 20 },
  center: { paddingVertical: space.xl, alignItems: "center", gap: space.sm },
  emptyTitle: { color: colors.paper, fontSize: 17, fontWeight: "600" },
  button: { borderRadius: radius.pill, paddingVertical: 14, alignItems: "center" },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonSecondary: { borderWidth: 1, borderColor: colors.line },
  buttonText: { color: colors.paper, fontSize: 16, fontWeight: "600" },
  buttonTextPrimary: { color: colors.accentInk, fontWeight: "700" },
});
