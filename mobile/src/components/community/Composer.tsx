import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { colors } from "@/theme/colors";

/**
 * The composer — a collapsed pill that expands into a small form. Only
 * rendered for accounts with an active membership (see customer/index.tsx);
 * posting itself is also enforced server-side by RLS.
 */
export function Composer({
  ownerName,
  avatarUrl,
  onSubmit,
}: {
  ownerName: string;
  avatarUrl?: string;
  onSubmit: (body: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  function collapse() {
    setExpanded(false);
    setBody("");
  }

  async function submit() {
    const trimmed = body.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    await onSubmit(trimmed);
    setPosting(false);
    collapse();
  }

  if (!expanded) {
    return (
      <Pressable style={styles.pill} onPress={() => setExpanded(true)}>
        <Avatar uri={avatarUrl} name={ownerName} size={36} />
        <Text style={styles.pillText} numberOfLines={1}>
          Share a cute update, or ask your question…
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.form}>
      <View style={styles.formHeader}>
        <Avatar uri={avatarUrl} name={ownerName} size={36} />
        <View>
          <Text style={styles.formName}>{ownerName}</Text>
          <Text style={styles.formSubtitle}>Posting to the community</Text>
        </View>
      </View>

      <TextInput
        style={styles.input}
        value={body}
        onChangeText={setBody}
        placeholder="Share something…"
        placeholderTextColor={colors.paperDim}
        multiline
        autoFocus
      />

      <View style={styles.formActions}>
        <Pressable onPress={collapse} hitSlop={8}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={submit}
          disabled={!body.trim() || posting}
          style={[styles.postButton, (!body.trim() || posting) && styles.postButtonDisabled]}
        >
          <Text style={styles.postButtonText}>{posting ? "Posting…" : "Post"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillText: {
    flex: 1,
    fontSize: 14,
    color: colors.paperDim,
  },
  form: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    padding: 16,
    gap: 12,
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  formName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.paper,
  },
  formSubtitle: {
    fontSize: 12,
    color: colors.paperDim,
  },
  input: {
    minHeight: 90,
    fontSize: 14,
    lineHeight: 20,
    color: colors.paper,
    textAlignVertical: "top",
  },
  formActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 16,
  },
  cancel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.paperDim,
  },
  postButton: {
    borderRadius: 999,
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.accentInk,
  },
});
