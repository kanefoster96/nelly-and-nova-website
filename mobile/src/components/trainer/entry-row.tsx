import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { AvatarCircle } from "@/components/avatar-circle";
import { Pressable } from "@/components/pressable";
import { Tag } from "@/components/ui";
import { entryTitle, formatTime, type CalendarEntry, type CalendarKind } from "@/data/trainer-schedule";
import { colors } from "@/theme";

/**
 * One thing on a day, as the Kanvas register lists its dancers: photo (or
 * initials), the dog's name, its owner underneath, and tags for anything
 * to notice. Each kind has its own colour everywhere it's shown.
 */
export const KIND_COLOR: Record<CalendarKind, string> = {
  full_day: colors.success,
  full_day_one_off: "#0ea5e9",
  one_to_one: "#8b5cf6",
  meet_greet: colors.warning,
};

export const KIND_LABEL: Record<CalendarKind, string> = {
  full_day: "Regular",
  full_day_one_off: "One-off",
  one_to_one: "1-1",
  meet_greet: "Meet & greet",
};

/** The entry's tags: its kind (a regular place needs none), its time, and "awaiting registration" for a held place. */
export function EntryTags({ entry, showRegular = false }: { entry: CalendarEntry; showRegular?: boolean }) {
  const held = entry.kind !== "meet_greet" && !entry.dogId;
  const time = entry.startTime ? formatTime(entry.startTime) : "";
  return (
    <>
      {(entry.kind !== "full_day" || showRegular) && (
        <Tag label={entry.kind === "one_to_one" || entry.kind === "meet_greet" ? `${KIND_LABEL[entry.kind]}${time ? ` · ${time}` : ""}` : KIND_LABEL[entry.kind]} tone={KIND_COLOR[entry.kind]} />
      )}
      {held && <Tag label="Awaiting registration" tone={colors.warning} />}
    </>
  );
}

export function EntryRow({
  entry,
  onPress,
  trailing,
  first = false,
}: {
  entry: CalendarEntry;
  onPress?: () => void;
  /** A small button at the end (remove). */
  trailing?: ReactNode;
  /** No hairline above. */
  first?: boolean;
}) {
  const title = entryTitle(entry);
  const subtitle =
    entry.kind === "meet_greet"
      ? entry.dogName
        ? `Meet & greet with ${entry.dogName}`
        : "Meet & greet"
      : entry.dogId
        ? (entry.ownerName ?? "")
        : entry.holderName && entry.holderName !== title
          ? entry.holderName
          : "Place held until they register";
  const body = (
    <>
      <AvatarCircle name={title} avatarUrl={entry.dogPhoto} size={40} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "600" }} numberOfLines={1}>
            {title}
          </Text>
          <EntryTags entry={entry} />
        </View>
        {!!subtitle && (
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {onPress && !trailing && <Ionicons name="chevron-forward" size={16} color={colors.muted} />}
    </>
  );
  const rowStyle = { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 } as const;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: first ? 0 : 1, borderTopColor: colors.border }}>
      {onPress ? (
        <Pressable onPress={onPress} style={rowStyle} accessibilityRole="button" accessibilityLabel={`${title}: open`}>
          {body}
        </Pressable>
      ) : (
        <View style={rowStyle}>{body}</View>
      )}
      {trailing}
    </View>
  );
}
