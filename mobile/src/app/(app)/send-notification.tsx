import { Ionicons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { useAuth } from "@/auth/AuthProvider";
import { AvatarCircle } from "@/components/avatar-circle";
import { Pressable } from "@/components/pressable";
import { ScreenHeader } from "@/components/screen-header";
import { IconBadge } from "@/components/trainer/cards";
import { CARD } from "@/components/ui";
import {
  BODY_MAX,
  getOwners,
  NOTIFICATION_EMOJIS,
  NOTIFICATION_LINKS,
  sendNotification,
  TITLE_MAX,
} from "@/data/notifications";
import { hapticError, hapticSelection, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { useAsync } from "@/lib/useAsync";
import { colors } from "@/theme";

const ICON = require("../../../assets/icon.png");
const ANY_EMOJI = /\p{Extended_Pictographic}/u;

/**
 * Trainer: Send a notification, after Kanvas's coach compose screen — a
 * live lock-screen preview, the message (one emoji to start the title, as
 * the automated notices have), who gets it (every owner, or the ones you
 * tick) and where tapping it goes. Each owner gets a row on their
 * Notifications and an app push (the website's /api/notifications/send).
 */
export default function SendNotificationScreen() {
  const { isTrainer } = useAuth();
  const insets = useSafeAreaInsets();
  const { data: owners, error: ownersError } = useAsync(getOwners);
  const [emoji, setEmoji] = useState(NOTIFICATION_EMOJIS[0]);
  const [titleText, setTitleText] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"everyone" | "chosen">("everyone");
  const [chosen, setChosen] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [path, setPath] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (owners ?? []).filter((o) => !q || o.name.toLowerCase().includes(q) || o.dogs.some((d) => d.toLowerCase().includes(q)));
  }, [owners, query]);

  if (!isTrainer) return <Redirect href="/community" />;

  const title = `${emoji} ${titleText.trim()}`;
  const recipientCount = audience === "everyone" ? (owners?.length ?? 0) : chosen.length;
  const missing = !titleText.trim() || !body.trim()
    ? "Add a title and a message."
    : ANY_EMOJI.test(titleText) || ANY_EMOJI.test(body)
      ? "Just the one emoji, at the start of the title."
      : recipientCount === 0
        ? "Choose who gets it."
        : null;
  const who = audience === "everyone" ? `all ${recipientCount} owners` : `${recipientCount} ${recipientCount === 1 ? "owner" : "owners"}`;

  async function submit() {
    setSending(true);
    setError(null);
    try {
      const result = await sendNotification({ title, body: body.trim(), audience, recipientIds: chosen, path });
      hapticSuccess();
      Alert.alert("Sent", `Delivered to ${result.sent} ${result.sent === 1 ? "owner" : "owners"} · ${result.pushed} on the app with notifications on.`, [
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch (err) {
      hapticError();
      setError(err instanceof Error ? err.message : "Couldn't send that — please try again.");
    } finally {
      setSending(false);
    }
  }

  /** Sending goes straight out to everyone chosen, so it's asked once. */
  function confirmAndSubmit() {
    if (missing || sending) return;
    hapticWarning();
    Alert.alert(`Send to ${who} now?`, "It goes out straight away and can't be taken back.", [
      { text: "Not yet", style: "cancel" },
      { text: "Send", onPress: () => void submit() },
    ]);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title="New Notification" />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Preview title={titleText.trim() ? title : ""} emoji={emoji} body={body} />

        <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 14 }}>
          {error && <Text style={{ color: colors.danger, fontSize: 14 }}>{error}</Text>}

          <View style={[CARD, { gap: 10 }]}>
            <CardHeading icon="create-outline" title="The message" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
              {NOTIFICATION_EMOJIS.map((e) => {
                const on = emoji === e;
                return (
                  <Pressable
                    key={e}
                    onPress={() => {
                      hapticSelection();
                      setEmoji(e);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: on ? 1.5 : 1, borderColor: on ? colors.foreground : colors.border, backgroundColor: on ? "rgba(245,245,242,0.12)" : colors.background }}
                  >
                    <Text style={{ fontSize: 20 }}>{e}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={[inputStyle, { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 0 }]}>
              <Text style={{ fontSize: 18 }}>{emoji}</Text>
              <TextInput
                value={titleText}
                onChangeText={(t) => setTitleText(t.slice(0, TITLE_MAX - 3))}
                placeholder="Title, e.g. Closed on Friday"
                placeholderTextColor={colors.muted}
                style={{ flex: 1, color: colors.foreground, fontSize: 17, fontWeight: "600", paddingVertical: 14 }}
              />
            </View>
            <Text style={{ color: TITLE_MAX - 3 - titleText.length <= 5 ? colors.warning : colors.muted, fontSize: 12, textAlign: "right" }}>
              {TITLE_MAX - 3 - titleText.length} left
            </Text>
            <TextInput
              value={body}
              onChangeText={(t) => setBody(t.slice(0, BODY_MAX))}
              placeholder="What do they need to know?"
              placeholderTextColor={colors.muted}
              multiline
              style={[inputStyle, { minHeight: 120, textAlignVertical: "top" }]}
            />
          </View>

          <View style={[CARD, { gap: 10 }]}>
            <CardHeading icon="people-outline" title="Who gets it" />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <ChoiceTile
                icon="people"
                label="Every owner"
                detail={owners ? `${owners.length} ${owners.length === 1 ? "person" : "people"}` : "…"}
                selected={audience === "everyone"}
                onPress={() => setAudience("everyone")}
              />
              <ChoiceTile
                icon="checkbox-outline"
                label="Choose owners"
                detail={chosen.length ? `${chosen.length} chosen` : "Tick who it's for"}
                selected={audience === "chosen"}
                onPress={() => setAudience("chosen")}
              />
            </View>
            {audience === "chosen" && (
              <View style={{ gap: 8 }}>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search owners or dogs"
                  placeholderTextColor={colors.muted}
                  autoCorrect={false}
                  style={[inputStyle, { paddingVertical: 10, borderRadius: 999 }]}
                />
                {ownersError ? (
                  <Text style={{ color: colors.danger, fontSize: 13 }}>Couldn&apos;t load the owners.</Text>
                ) : !owners ? (
                  <ActivityIndicator color={colors.muted} />
                ) : visible.length === 0 ? (
                  <Text style={{ color: colors.muted, fontSize: 13 }}>No owners match.</Text>
                ) : (
                  visible.map((o) => {
                    const on = chosen.includes(o.id);
                    return (
                      <Pressable
                        key={o.id}
                        onPress={() => {
                          hapticSelection();
                          setChosen((c) => (on ? c.filter((id) => id !== o.id) : [...c, o.id]));
                        }}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        style={{ flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: on ? colors.foreground : colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 }}
                      >
                        <Ionicons name={on ? "checkbox" : "square-outline"} size={20} color={on ? colors.foreground : colors.muted} />
                        <AvatarCircle name={o.name} avatarUrl={o.avatarUrl} size={30} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>
                            {o.name}
                          </Text>
                          {o.dogs.length > 0 && (
                            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
                              {o.dogs.join(", ")}
                            </Text>
                          )}
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </View>
            )}
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>Tapping it opens</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {NOTIFICATION_LINKS.map((l) => {
                const on = path === l.value;
                return (
                  <Pressable
                    key={l.value || "none"}
                    onPress={() => {
                      hapticSelection();
                      setPath(l.value);
                    }}
                    accessibilityState={{ selected: on }}
                    style={{ borderRadius: 999, borderWidth: 1, borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accent : "transparent", paddingHorizontal: 14, paddingVertical: 8 }}
                  >
                    <Text style={{ color: on ? colors.accentForeground : colors.foreground, fontSize: 14, fontWeight: "600" }}>{l.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* The one thing to press, always in reach, saying exactly what it'll do. */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12), borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, gap: 6 }}>
        <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>{missing ?? `To ${who}, in the app and on their Notifications`}</Text>
        <Pressable
          onPress={confirmAndSubmit}
          disabled={!!missing || sending}
          accessibilityRole="button"
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 54, backgroundColor: colors.accent, borderRadius: 999, opacity: missing || sending ? 0.45 : 1 }}
        >
          {sending ? (
            <ActivityIndicator color={colors.accentForeground} />
          ) : (
            <>
              <Ionicons name="paper-plane" size={18} color={colors.accentForeground} />
              <Text style={{ color: colors.accentForeground, fontSize: 16, fontWeight: "700" }}>Send Now</Text>
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

/** How it'll look on a locked iPhone, as it's typed (Kanvas's notification-preview.tsx). */
function Preview({ title, emoji, body }: { title: string; emoji: string; body: string }) {
  const hasTitle = title !== "";
  const hasBody = body.trim() !== "";
  return (
    <View style={{ marginHorizontal: 20, marginTop: 8, borderRadius: 24, overflow: "hidden" }}>
      <Svg style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%">
        <Defs>
          <LinearGradient id="lock" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#3a2a4a" />
            <Stop offset="0.55" stopColor="#1c1a24" />
            <Stop offset="1" stopColor="#4a2414" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#lock)" />
      </Svg>
      <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "600", textAlign: "center", marginTop: 16 }}>Preview on a locked iPhone</Text>
      <View style={{ margin: 12, padding: 12, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.16)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", flexDirection: "row", gap: 10 }}>
        <Image source={ICON} style={{ width: 38, height: 38, borderRadius: 9 }} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            <Text numberOfLines={1} style={{ flex: 1, color: hasTitle ? "#fff" : "rgba(255,255,255,0.55)", fontSize: 15, fontWeight: "600" }}>
              {hasTitle ? title : `${emoji} Your title`}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>now</Text>
          </View>
          <Text numberOfLines={4} style={{ color: hasBody ? "#fff" : "rgba(255,255,255,0.55)", fontSize: 15, lineHeight: 20, marginTop: 1 }}>
            {hasBody ? body : "Your message shows here, up to four lines on a locked phone."}
          </Text>
        </View>
      </View>
      <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, textAlign: "center", marginBottom: 14, paddingHorizontal: 16 }}>
        Anything cut off shows in full when they open it.
      </Text>
    </View>
  );
}

const inputStyle = {
  color: colors.foreground,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.background,
  borderRadius: 14,
  paddingHorizontal: 14,
  paddingVertical: 14,
  fontSize: 16,
} as const;

function CardHeading({ icon, title }: { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
      <IconBadge icon={icon} size={34} />
      <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}>{title}</Text>
    </View>
  );
}

/** A big tappable choice, one of a set. */
function ChoiceTile({
  icon,
  label,
  detail,
  selected,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        hapticSelection();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={{
        flex: 1,
        alignItems: "center",
        gap: 6,
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? colors.foreground : colors.border,
        backgroundColor: selected ? "rgba(245,245,242,0.08)" : colors.background,
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 6,
      }}
    >
      <Ionicons name={icon} size={22} color={selected ? colors.foreground : colors.muted} />
      <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: selected ? "700" : "500", textAlign: "center" }}>{label}</Text>
      {detail && <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center" }}>{detail}</Text>}
    </Pressable>
  );
}
