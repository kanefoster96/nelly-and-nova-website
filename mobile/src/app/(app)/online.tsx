import { Ionicons } from "@expo/vector-icons";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { Appear } from "@/components/appear";
import { AvatarCircle } from "@/components/avatar-circle";
import { Pressable } from "@/components/pressable";
import { RefreshControl } from "@/components/refresh-control";
import { ScreenHeader } from "@/components/screen-header";
import { BigButton } from "@/components/trainer/cards";
import { CARD, LoadingState, Tag } from "@/components/ui";
import { boardHeadline, DRILL_RATINGS, getOnlineBoard, OVERALL_LABEL, saveGoals, weekLabel, type OnlineBoard, type OnlineMember } from "@/data/memberships";
import { conversationForAccount, formatShortDay } from "@/data/trainer-schedule";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { colors } from "@/theme";

const RATING_LABEL = Object.fromEntries(DRILL_RATINGS.map((r) => [r.value, r.label])) as Record<string, string>;

/**
 * Trainer: Online Training (Menu → Online Training). Every online member
 * and their dog: their goals (an editable list), the last check-in or "No
 * check-in this week", and whether this week's homework has gone. "Send
 * this week's homework" opens the editor (online-week/[dogId].tsx). Nothing
 * here is automatic: the homework is the trainer's own each week.
 */
export default function OnlineBoardScreen() {
  const { isTrainer } = useAuth();
  const [board, setBoard] = useState<OnlineBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setBoard(await getOnlineBoard());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load Online Training.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!isTrainer) return <Redirect href="/community" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Online Training" subtitle={board ? boardHeadline(board) : null} />
      {!board ? (
        <LoadingState error={error} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor={colors.foreground}
            />
          }
        >
          {error && <Text style={{ color: colors.danger }}>{error}</Text>}
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
            Homework for the {weekLabel(board.homeworkWeek).toLowerCase()}. Check-ins come in on Sunday evenings, and as a card in their chat.
          </Text>
          {board.members.length === 0 && (
            <View style={[CARD, { alignItems: "center", paddingVertical: 28 }]}>
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>No online members yet</Text>
              <Text style={{ color: colors.muted, fontSize: 14, marginTop: 6, textAlign: "center" }}>Start one from a dog&apos;s page: Start membership → Online Training.</Text>
            </View>
          )}
          {board.members.map((m, i) => (
            <Appear key={m.placementId} index={i}>
              <MemberCard member={m} checkinWeek={board.checkinWeek} onChanged={load} />
            </Appear>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function MemberCard({ member: m, checkinWeek, onChanged }: { member: OnlineMember; checkinWeek: string; onChanged: () => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [goals, setGoals] = useState<string[]>(m.goals);
  const [busy, setBusy] = useState(false);
  const c = m.lastCheckin;
  const thisWeek = m.checkedInThisWeek && c?.weekOf === checkinWeek;

  async function save() {
    setBusy(true);
    try {
      await saveGoals(m.placementId, goals);
      hapticSuccess();
      setEditing(false);
      onChanged();
    } catch (err) {
      hapticError();
      Alert.alert("Couldn't save the goals", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function message() {
    if (!m.accountId) return;
    try {
      const id = await conversationForAccount(m.accountId);
      router.push({ pathname: "/conversation/[id]", params: { id } });
    } catch (err) {
      Alert.alert("Couldn't open their chat", err instanceof Error ? err.message : "Please try again.");
    }
  }

  return (
    <View style={[CARD, { gap: 12 }]}>
      <Pressable
        onPress={() => m.dogId && router.push({ pathname: "/dog/[id]", params: { id: m.dogId } })}
        style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
        accessibilityRole="button"
      >
        <AvatarCircle name={m.dogName} avatarUrl={m.dogPhoto} size={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>{m.dogName}</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>
            {m.ownerName ?? "Owner"} · since {formatShortDay(m.startOn)}
          </Text>
        </View>
        <Tag label={m.thisWeekCardId ? "Sent" : "To send"} tone={m.thisWeekCardId ? colors.success : colors.warning} />
      </Pressable>

      {/* Goals */}
      <View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ flex: 1, color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>Goals</Text>
          {!editing && (
            <Pressable
              onPress={() => {
                setGoals(m.goals.length ? m.goals : [""]);
                setEditing(true);
              }}
              hitSlop={8}
            >
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>Edit</Text>
            </Pressable>
          )}
        </View>
        {editing ? (
          <View style={{ gap: 8, marginTop: 8 }}>
            {goals.map((g, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TextInput
                  value={g}
                  onChangeText={(t) => setGoals((list) => list.map((x, j) => (j === i ? t : x)))}
                  placeholder="A goal"
                  placeholderTextColor={colors.muted}
                  maxLength={200}
                  style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, fontSize: 15 }}
                />
                <Pressable onPress={() => setGoals((list) => list.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel="Remove goal">
                  <Ionicons name="close-circle" size={20} color={colors.muted} />
                </Pressable>
              </View>
            ))}
            <Pressable onPress={() => setGoals((list) => [...list, ""])} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 }}>
              <Ionicons name="add-circle-outline" size={18} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>Add a goal</Text>
            </Pressable>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <BigButton label="Save goals" busy={busy} onPress={save} style={{ flex: 1, minHeight: 44 }} />
              <BigButton label="Cancel" variant="outline" onPress={() => setEditing(false)} style={{ flex: 1, minHeight: 44 }} />
            </View>
          </View>
        ) : m.goals.length ? (
          <View style={{ marginTop: 6, gap: 4 }}>
            {m.goals.map((g, i) => (
              <Text key={i} style={{ color: colors.foreground, fontSize: 14, lineHeight: 20 }}>
                • {g}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 6 }}>No goals yet.</Text>
        )}
      </View>

      {/* Check-in */}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>
          {thisWeek ? "This week's check-in" : "Check-in"}
        </Text>
        {!thisWeek && <Text style={{ color: colors.warning, fontSize: 14, fontWeight: "600", marginTop: 4 }}>No check-in this week</Text>}
        {c && (
          <View style={{ marginTop: 4, gap: 4 }}>
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>
              {thisWeek ? "" : `Last: ${weekLabel(c.weekOf)} · `}
              {c.overall ? OVERALL_LABEL[c.overall] : "Checked in"}
              {c.video ? " · video in chat" : ""}
            </Text>
            {c.drills.length > 0 && (
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>{c.drills.map((d) => `${d.name}: ${RATING_LABEL[d.rating] ?? d.rating}`).join(" · ")}</Text>
            )}
            {!!c.note && <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 20 }}>“{c.note}”</Text>}
          </View>
        )}
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        {m.dogId && (
          <BigButton
            icon={m.thisWeekCardId ? "create-outline" : "send-outline"}
            label={m.thisWeekCardId ? "This week's homework" : "Send this week's homework"}
            variant={m.thisWeekCardId ? "outline" : "solid"}
            onPress={() =>
              m.thisWeekCardId
                ? router.push({ pathname: "/report-card", params: { dogId: m.dogId!, cardId: m.thisWeekCardId, focus: "homework" } })
                : router.push({ pathname: "/online-week/[dogId]", params: { dogId: m.dogId!, name: m.dogName, last: m.lastCardId ?? "" } })
            }
            style={{ flex: 1, minHeight: 46 }}
          />
        )}
        {m.accountId && (
          <Pressable
            onPress={message}
            accessibilityRole="button"
            accessibilityLabel="Message"
            style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.foreground} />
          </Pressable>
        )}
      </View>
    </View>
  );
}
