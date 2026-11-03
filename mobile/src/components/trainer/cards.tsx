import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { Appear } from "@/components/appear";
import { Pressable } from "@/components/pressable";
import { colors, GLASS_BORDER } from "@/theme";

/*
 * The building blocks of the trainer pages, from the Kanvas app's coach
 * pages (components/coach/cards.tsx and detail-card.tsx): big rounded cards
 * with room to breathe, a round icon, a row of action tiles.
 */

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export const CARD_RADIUS = 20;

/** The round icon a card starts with. */
export function IconBadge({ icon, color = colors.foreground, background = "rgba(245,245,242,0.08)", size = 40 }: { icon: IoniconName; color?: string; background?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: background }}>
      <Ionicons name={icon} size={Math.round(size * 0.48)} color={color} />
    </View>
  );
}

/** A page in the trainer's Menu, as a card: icon, name, what it's for. */
export function MenuCard({ icon, title, description, count, onPress }: { icon: IoniconName; title: string; description: string; count?: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count ? `${title}, ${count}` : title}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        borderWidth: 1,
        ...GLASS_BORDER,
        backgroundColor: colors.surface,
        borderRadius: CARD_RADIUS,
        padding: 16,
      }}
    >
      <IconBadge icon={icon} size={44} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2, lineHeight: 18 }}>{description}</Text>
      </View>
      {!!count && (
        <View style={{ minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 7, alignItems: "center", justifyContent: "center", backgroundColor: colors.warning }}>
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>{count}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

/** The small grey heading above a group of cards. */
export function GroupHeading({ children, aside, style }: { children: ReactNode; aside?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 10 }, style]}>
      <Text style={{ color: colors.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>{children}</Text>
      {aside}
    </View>
  );
}

/** One rounded panel per topic on a dog's page. */
export function DetailCard({
  index = 0,
  title,
  icon,
  tone,
  children,
}: {
  index?: number;
  title?: string;
  icon?: IoniconName;
  tone?: "danger";
  children: ReactNode;
}) {
  const accent = tone === "danger" ? colors.danger : colors.muted;
  return (
    <Appear
      index={index}
      style={{
        marginTop: 14,
        borderWidth: 1,
        ...GLASS_BORDER,
        ...(tone === "danger" ? { borderColor: "rgba(225,29,51,0.45)" } : null),
        backgroundColor: tone === "danger" ? "rgba(225,29,51,0.08)" : colors.surface,
        borderRadius: 18,
        padding: 16,
      }}
    >
      {!!title && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
          {!!icon && <Ionicons name={icon} size={16} color={accent} />}
          <Text style={{ color: accent, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>{title}</Text>
        </View>
      )}
      {children}
    </Appear>
  );
}

/** A big square button in a card's row of quick actions: Message, Call, Email. */
export function ActionTile({ icon, label, onPress, disabled, busy }: { icon: IoniconName; label: string; onPress: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: colors.accent,
        opacity: disabled ? 0.3 : 1,
      }}
    >
      {busy ? <ActivityIndicator color={colors.accentForeground} /> : <Ionicons name={icon} size={20} color={colors.accentForeground} />}
      <Text style={{ color: colors.accentForeground, fontSize: 13, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

/** A full-width pill button: solid for the main thing to do, outlined beside it. */
export function BigButton({
  icon,
  label,
  onPress,
  variant = "solid",
  disabled,
  busy,
  style,
}: {
  icon?: IoniconName;
  label: string;
  onPress: () => void;
  variant?: "solid" | "outline";
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const solid = variant === "solid";
  const fg = solid ? colors.accentForeground : colors.foreground;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          minHeight: 52,
          borderRadius: 999,
          paddingHorizontal: 18,
          backgroundColor: solid ? colors.accent : "transparent",
          borderWidth: solid ? 0 : 1,
          borderColor: colors.border,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 15, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

/** A choice in a short list of options (a cadence, a path): a card with a tick when chosen. */
export function ChoiceCard({
  icon,
  title,
  description,
  selected,
  onPress,
  disabled,
}: {
  icon?: IoniconName;
  title: string;
  description?: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderWidth: 1,
        ...GLASS_BORDER,
        ...(selected ? { borderColor: "rgba(34,197,94,0.55)" } : null),
        backgroundColor: selected ? "rgba(34,197,94,0.08)" : colors.surface,
        borderRadius: 16,
        padding: 14,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {icon && <IconBadge icon={icon} size={38} color={selected ? colors.success : colors.foreground} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>{title}</Text>
        {!!description && <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2, lineHeight: 18 }}>{description}</Text>}
      </View>
      <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={22} color={selected ? colors.success : colors.muted} />
    </Pressable>
  );
}
