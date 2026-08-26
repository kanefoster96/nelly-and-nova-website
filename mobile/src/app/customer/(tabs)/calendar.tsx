import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/Button";
import { requestCancellation, requestExtraSession, requestReschedule } from "@/lib/calendar";
import { getUpcomingSessions, sessionKindLabel, type UpcomingSession } from "@/lib/dogs";
import { activeDog, useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme/colors";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

/**
 * All upcoming sessions, with reschedule/cancel requests and a way to ask
 * for an extra session. Members can't edit training_sessions directly
 * (trainer-only via RLS) — everything here is a *request* the trainer
 * reviews, same as the website's cancellation policy. No date picker yet:
 * "reason" is where a preferred date goes for now.
 */
export default function CalendarScreen() {
  const session = useSession();
  const dog = activeDog(session);

  const [sessions, setSessions] = useState<UpcomingSession[] | null>(null);
  const [showBooking, setShowBooking] = useState(false);

  useEffect(() => {
    if (!dog) return;
    let cancelled = false;
    getUpcomingSessions(dog.id).then((result) => {
      if (!cancelled) setSessions(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dog?.id]);

  if (!session || !dog) return null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {showBooking ? (
        <BookExtraSessionForm
          ownerName={session.ownerName}
          dogName={dog.name}
          onDone={() => setShowBooking(false)}
        />
      ) : (
        <Button title="Book an extra session" onPress={() => setShowBooking(true)} />
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upcoming sessions</Text>
        {sessions === null ? (
          <ActivityIndicator color={colors.accent} />
        ) : sessions.length === 0 ? (
          <Text style={styles.emptyText}>No upcoming sessions scheduled.</Text>
        ) : (
          <View style={styles.list}>
            {sessions.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function SessionRow({ session }: { session: UpcomingSession }) {
  const [mode, setMode] = useState<"closed" | "reschedule" | "cancel">("closed");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    setSending(true);
    const { error } = mode === "cancel" ? await requestCancellation(session.id, reason) : await requestReschedule(session.id, reason);
    setSending(false);
    if (!error) {
      setSent(true);
      setMode("closed");
    }
  }

  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name="calendar-outline" size={20} color={colors.accent} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowKind}>{sessionKindLabel(session.kind)}</Text>
        <Text style={styles.rowWhen}>{formatWhen(session.scheduledAt)}</Text>
        {session.location ? <Text style={styles.rowLocation}>{session.location}</Text> : null}

        {sent && <Text style={styles.sentText}>Request sent — we&apos;ll be in touch.</Text>}

        {mode === "closed" && !sent && (
          <View style={styles.actionsRow}>
            <Pressable onPress={() => setMode("reschedule")}>
              <Text style={styles.actionLink}>Reschedule</Text>
            </Pressable>
            <Pressable onPress={() => setMode("cancel")}>
              <Text style={styles.actionLinkMuted}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {(mode === "reschedule" || mode === "cancel") && (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              value={reason}
              onChangeText={setReason}
              placeholder={
                mode === "reschedule" ? "Preferred day/time, and why…" : "Let us know why (optional)…"
              }
              placeholderTextColor={colors.paperDim}
              multiline
            />
            <View style={styles.formActions}>
              <Pressable onPress={() => setMode("closed")} hitSlop={8}>
                <Text style={styles.cancelLink}>Back</Text>
              </Pressable>
              <Pressable onPress={submit} disabled={sending} hitSlop={8}>
                <Text style={styles.submitLink}>
                  {sending ? "Sending…" : mode === "cancel" ? "Request cancellation" : "Request reschedule"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function BookExtraSessionForm({
  ownerName,
  dogName,
  onDone,
}: {
  ownerName: string;
  dogName: string;
  onDone: () => void;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    setSending(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await requestExtraSession({
      ownerName,
      email: user?.email ?? "",
      dogName,
      message,
    });
    setSending(false);
    if (!error) setSent(true);
  }

  if (sent) {
    return (
      <View style={styles.bookingCard}>
        <Text style={styles.sentText}>Request sent — we&apos;ll be in touch to arrange it.</Text>
        <Pressable onPress={onDone} hitSlop={8}>
          <Text style={styles.cancelLink}>Close</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.bookingCard}>
      <Text style={styles.bookingTitle}>Book an extra session</Text>
      <TextInput
        style={styles.input}
        value={message}
        onChangeText={setMessage}
        placeholder="What would you like, and when?"
        placeholderTextColor={colors.paperDim}
        multiline
      />
      <View style={styles.formActions}>
        <Pressable onPress={onDone} hitSlop={8}>
          <Text style={styles.cancelLink}>Cancel</Text>
        </Pressable>
        <Pressable onPress={submit} disabled={sending} hitSlop={8}>
          <Text style={styles.submitLink}>{sending ? "Sending…" : "Send request"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const H_PADDING = 16;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  content: {
    paddingHorizontal: H_PADDING,
    paddingVertical: 20,
    gap: 20,
  },
  bookingCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    padding: 16,
    gap: 12,
  },
  bookingTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.paper,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.accent,
  },
  list: {
    gap: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    padding: 14,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowKind: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.paper,
  },
  rowWhen: {
    fontSize: 13,
    color: "rgba(245,242,234,0.85)",
  },
  rowLocation: {
    fontSize: 12,
    color: colors.paperDim,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
  },
  actionLink: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.accent,
  },
  actionLinkMuted: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.paperDim,
  },
  form: {
    marginTop: 10,
    gap: 10,
  },
  input: {
    minHeight: 60,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(0,0,0,0.2)",
    padding: 12,
    fontSize: 13,
    lineHeight: 18,
    color: colors.paper,
    textAlignVertical: "top",
  },
  formActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 20,
  },
  cancelLink: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.paperDim,
  },
  submitLink: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.accent,
  },
  sentText: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "600",
    color: "#4ade80",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.paperDim,
  },
});
