import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { sendBroadcast } from "@/lib/broadcast";
import { colors } from "@/theme/colors";

/** Collapsed pill -> notification/email blast form, sent to every real member. */
export function BroadcastComposer() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [alsoEmail, setAlsoEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function send() {
    if (!title.trim() || !body.trim() || sending) return;
    setSending(true);
    setResult(null);
    try {
      const res = await sendBroadcast({ title: title.trim(), body: body.trim(), alsoEmail });
      let message = `Sent to ${res.notifiedCount} customer${res.notifiedCount === 1 ? "" : "s"}.`;
      if (res.email) {
        message += res.email.skipped
          ? " Email skipped (not configured yet)."
          : ` ${res.email.sent} email${res.email.sent === 1 ? "" : "s"} sent.`;
      }
      setResult(message);
      setTitle("");
      setBody("");
      setOpen(false);
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <Pressable style={styles.pill} onPress={() => setOpen(true)}>
        <Ionicons name="megaphone-outline" size={18} color={colors.accent} />
        <Text style={styles.pillText}>Send a notification to all customers</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Notify everyone</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Title"
        placeholderTextColor={colors.paperDim}
      />
      <TextInput
        style={[styles.input, styles.bodyInput]}
        value={body}
        onChangeText={setBody}
        placeholder="Message"
        placeholderTextColor={colors.paperDim}
        multiline
      />
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Also email everyone</Text>
        <Switch
          value={alsoEmail}
          onValueChange={setAlsoEmail}
          trackColor={{ false: colors.border, true: colors.accent }}
        />
      </View>
      <View style={styles.actions}>
        <Pressable onPress={() => setOpen(false)} hitSlop={8}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable onPress={send} disabled={!title.trim() || !body.trim() || sending} hitSlop={8}>
          <Text style={[styles.sendText, (!title.trim() || !body.trim() || sending) && styles.sendTextDisabled]}>
            {sending ? "Sending…" : "Send"}
          </Text>
        </Pressable>
      </View>
      {result && <Text style={styles.resultText}>{result}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pillText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.paper,
  },
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    padding: 16,
    gap: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.paper,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.paper,
  },
  bodyInput: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchLabel: {
    fontSize: 13,
    color: colors.paperDim,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 20,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.paperDim,
  },
  sendText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.accent,
  },
  sendTextDisabled: {
    opacity: 0.5,
  },
  resultText: {
    fontSize: 12,
    color: "#4ade80",
  },
});
