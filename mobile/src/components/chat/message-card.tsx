import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { AttachmentContent } from "@/components/chat/attachment-content";
import { Pressable } from "@/components/pressable";
import { longDay, shortDay, type ChatCard, type RequestStatus } from "@/data/inbox/cards";
import type { Attachment } from "@/data/inbox";
import { hapticTap } from "@/lib/haptics";
import { colors, GLASS_BORDER } from "@/theme";

type IoniconName = keyof typeof Ionicons.glyphMap;
type Tone = { fg: string; bg: string };

const AMBER: Tone = { fg: "#fbbf24", bg: "rgba(245,158,11,0.16)" };
const GREEN: Tone = { fg: "#86efac", bg: "rgba(34,197,94,0.16)" };
const RED: Tone = { fg: "#fca5a5", bg: "rgba(225,29,51,0.16)" };
const BLUE: Tone = { fg: "#93c5fd", bg: "rgba(59,130,246,0.18)" };
const GREY: Tone = { fg: colors.muted, bg: "rgba(245,242,234,0.08)" };

const REQUEST_STATUS: Record<RequestStatus, { label: string; tone: Tone }> = {
  pending: { label: "Waiting", tone: AMBER },
  offered: { label: "Days offered", tone: BLUE },
  confirmed: { label: "Confirmed", tone: GREEN },
  declined: { label: "Declined", tone: RED },
  withdrawn: { label: "Withdrawn", tone: GREY },
};

type Action = { key: string; label: string; onPress: () => void; solid?: boolean };

/**
 * A system line as a compact card in the thread — the Kanvas app's payment
 * and discount cards, for Nelly & Nova's things: an icon, the title, a
 * details line, a status pill, and buttons where there's something to do.
 *
 *   request       Accept / Suggest / Decline (trainer, while it's waiting) or
 *                 View (owner): both open the request screen.
 *   cancellation  The dates; View opens the owner's schedule.
 *   homework_day  The owner's note and video inline; Reply (trainer) starts
 *                 an answer in the composer, View (owner) opens the homework.
 *   report_card   Open report.
 */
export function MessageCard({
  card,
  viewerIsStaff,
  attachment,
  liveStatus,
  onReply,
}: {
  card: ChatCard;
  viewerIsStaff: boolean;
  /** A homework day's video. */
  attachment?: Attachment;
  /** A request's status now, when it's been looked up. */
  liveStatus?: RequestStatus;
  /** Trainer, a homework day: start a reply in the composer. */
  onReply?: (text: string) => void;
}) {
  const router = useRouter();
  const go = (href: Parameters<typeof router.push>[0]) => {
    hapticTap();
    router.push(href);
  };

  let icon: IoniconName;
  let iconTone: Tone;
  let title: string;
  let details: string;
  let pill: { label: string; tone: Tone };
  let note: string | null = null;
  let actions: Action[] = [];
  let media: Attachment | undefined;

  if (card.kind === "request") {
    const status = liveStatus ?? card.status;
    const openRequest = () => go({ pathname: "/requests/[id]", params: { id: card.requestId } });
    icon = "calendar";
    pill = REQUEST_STATUS[status];
    iconTone = pill.tone;
    title = card.title;
    details = [card.dog, card.dates].filter(Boolean).join(" · ");
    note = card.note;
    actions = viewerIsStaff
      ? status === "pending"
        ? [
            { key: "accept", label: "Accept", onPress: openRequest, solid: true },
            { key: "suggest", label: "Suggest", onPress: openRequest },
            { key: "decline", label: "Decline", onPress: openRequest },
          ]
        : [{ key: "view", label: "View", onPress: openRequest }]
      : [{ key: "view", label: status === "offered" ? "Pick a day" : "View", onPress: openRequest, solid: status === "offered" }];
  } else if (card.kind === "cancellation") {
    icon = "close-circle";
    iconTone = RED;
    title = card.count > 1 ? `${card.count} sessions cancelled` : "Session cancelled";
    const when = card.count > 1 && card.from && card.to ? `${shortDay(card.from)} to ${shortDay(card.to)}` : card.when || longDay(card.from);
    details = [card.dog, when].filter(Boolean).join(" · ");
    pill = { label: "Cancelled", tone: RED };
    note = card.reason;
    actions = viewerIsStaff ? [] : [{ key: "view", label: "View schedule", onPress: () => go("/schedule") }];
  } else if (card.kind === "homework_day") {
    const complete = card.day >= card.of;
    icon = "school";
    iconTone = complete ? GREEN : BLUE;
    title = `Homework: ${card.title}`;
    details = [card.dog, `Day ${card.day} of ${card.of}`].filter(Boolean).join(" · ");
    pill = complete ? { label: "Complete", tone: GREEN } : { label: `Day ${card.day} of ${card.of}`, tone: BLUE };
    note = card.note;
    media = attachment;
    actions = viewerIsStaff
      ? onReply
        ? [{ key: "reply", label: "Reply", onPress: () => onReply(`${card.title}, day ${card.day}: `), solid: true }]
        : []
      : [{ key: "view", label: "View homework", onPress: () => go({ pathname: "/homework-detail/[id]", params: { id: card.cardId } }) }];
  } else {
    icon = "document-text";
    iconTone = GREEN;
    title = `Report card: ${card.title}`;
    details = [card.dog, longDay(card.date)].filter(Boolean).join(" · ");
    pill = card.homework > 0 ? { label: "Homework set", tone: GREEN } : { label: "Report", tone: GREY };
    // Trainer: the card itself. Owner: its page (notes and homework), or the
    // Profile tab's latest report card when there's no homework on it.
    const dogId = card.dogId;
    const open = viewerIsStaff
      ? dogId
        ? () => go({ pathname: "/report-card", params: { dogId, cardId: card.cardId } })
        : null
      : () => (card.homework > 0 ? go({ pathname: "/homework-detail/[id]", params: { id: card.cardId } }) : go("/dog"));
    actions = open ? [{ key: "open", label: "Open report", onPress: open, solid: true }] : [];
  }

  return (
    <View
      accessible={false}
      style={{ width: 268, maxWidth: "100%", borderRadius: 18, borderWidth: 1, ...GLASS_BORDER, backgroundColor: colors.surface, padding: 12, gap: 10 }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: iconTone.bg, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={19} color={iconTone.fg} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text numberOfLines={2} style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>
            {title}
          </Text>
          {!!details && (
            <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 13 }}>
              {details}
            </Text>
          )}
        </View>
      </View>

      <View style={{ flexDirection: "row" }}>
        <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: pill.tone.bg }}>
          <Text style={{ color: pill.tone.fg, fontSize: 12, fontWeight: "700" }}>{pill.label}</Text>
        </View>
      </View>

      {!!note && <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 20 }}>{card.kind === "homework_day" ? note : `“${note}”`}</Text>}

      {media && (
        <View style={{ alignSelf: "center" }}>
          <AttachmentContent attachment={media} mine={false} />
        </View>
      )}

      {actions.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {actions.map((a) => (
            <Pressable
              key={a.key}
              onPress={a.onPress}
              accessibilityRole="button"
              hitSlop={4}
              style={{
                flexGrow: 1,
                minHeight: 36,
                borderRadius: 999,
                paddingHorizontal: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: a.solid ? colors.accent : "transparent",
                borderWidth: a.solid ? 0 : 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: a.solid ? colors.accentForeground : colors.foreground, fontSize: 14, fontWeight: "700" }}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
