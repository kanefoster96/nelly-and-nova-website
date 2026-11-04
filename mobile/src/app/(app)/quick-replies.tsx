import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";

import { Pressable } from "@/components/pressable";
import { ScreenHeader } from "@/components/screen-header";
import { BigButton } from "@/components/trainer/cards";
import { CARD, FormScrollView, LoadingState } from "@/components/ui";
import { DAY_TOKEN, DEFAULT_QUICK_REPLIES, getQuickReplies, saveQuickReplies } from "@/data/inbox/cards";
import { hapticError, hapticSuccess, hapticTap } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { colors } from "@/theme";

const MAX = 12;
const MAX_LENGTH = 200;

type Row = { key: string; text: string };
let nextKey = 0;
const toRows = (list: string[]): Row[] => list.map((text) => ({ key: String(nextKey++), text }));

/**
 * Trainer: Edit quick replies — the chips above the composer in an owner's
 * chat (press and hold one to get here). Each trainer has their own list;
 * tapping a chip puts it in the message box, it never sends by itself.
 * "{day}" becomes the day of the owner's next session.
 */
export default function QuickRepliesScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getQuickReplies().then((list) => setRows(toRows(list)));
  }, []);

  function update(key: string, text: string) {
    setRows((prev) => prev?.map((r) => (r.key === key ? { ...r, text } : r)) ?? prev);
  }

  function remove(key: string) {
    hapticTap();
    animateListChange();
    setRows((prev) => prev?.filter((r) => r.key !== key) ?? prev);
  }

  function moveUp(key: string) {
    hapticTap();
    animateListChange();
    setRows((prev) => {
      if (!prev) return prev;
      const i = prev.findIndex((r) => r.key === key);
      if (i <= 0) return prev;
      const next = [...prev];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next;
    });
  }

  function add() {
    hapticTap();
    animateListChange();
    setRows((prev) => [...(prev ?? []), ...toRows([""])]);
  }

  async function save(list: string[] | null) {
    setSaving(true);
    try {
      await saveQuickReplies(list);
      hapticSuccess();
      if (router.canGoBack()) router.back();
      else setRows(toRows(list ?? DEFAULT_QUICK_REPLIES));
    } catch (err) {
      hapticError();
      Alert.alert("Couldn't save your quick replies", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function resetToDefaults() {
    Alert.alert("Go back to the standard quick replies?", DEFAULT_QUICK_REPLIES.join("\n"), [
      { text: "Cancel", style: "cancel" },
      { text: "Reset", style: "destructive", onPress: () => void save(null) },
    ]);
  }

  const tooLong = rows?.some((r) => r.text.trim().length > MAX_LENGTH) ?? false;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Quick replies" subtitle="Tap one above the message box in an owner's chat to add it to your message. Only you see your list." />
      {!rows ? (
        <LoadingState />
      ) : (
        <FormScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48, gap: 12 }}>
          <View style={[CARD, { gap: 10 }]}>
            {rows.length === 0 && <Text style={{ color: colors.muted, fontSize: 14 }}>No quick replies. Add one below.</Text>}
            {rows.map((row, i) => (
              <View key={row.key} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={row.text}
                    placeholderTextColor={colors.muted}
                    multiline
                    style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 11, minHeight: 44, color: colors.foreground, fontSize: 16, backgroundColor: colors.background }}
                    onChangeText={(t) => update(row.key, t)}
                    placeholder="e.g. Thanks, see you {day}!"
                    autoCapitalize="sentences"
                    autoCorrect
                    maxLength={MAX_LENGTH + 20}
                    accessibilityLabel={`Quick reply ${i + 1}`}
                  />
                </View>
                <Pressable
                  onPress={() => moveUp(row.key)}
                  disabled={i === 0}
                  accessibilityRole="button"
                  accessibilityLabel="Move up"
                  hitSlop={4}
                  style={{ width: 34, height: 44, alignItems: "center", justifyContent: "center", opacity: i === 0 ? 0.3 : 1 }}
                >
                  <Ionicons name="arrow-up" size={18} color={colors.muted} />
                </Pressable>
                <Pressable
                  onPress={() => remove(row.key)}
                  accessibilityRole="button"
                  accessibilityLabel="Remove"
                  hitSlop={4}
                  style={{ width: 34, height: 44, alignItems: "center", justifyContent: "center" }}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              </View>
            ))}
            {rows.length < MAX && <BigButton icon="add" label="Add a quick reply" variant="outline" onPress={add} />}
          </View>

          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
            Write {DAY_TOKEN} for the day of the owner&apos;s next session: &ldquo;Thanks, see you {DAY_TOKEN}!&rdquo; shows as &ldquo;Thanks, see you Thursday!&rdquo;, or
            &ldquo;Thanks, see you soon!&rdquo; when they haven&apos;t one booked. Up to {MAX}.
          </Text>
          {tooLong && <Text style={{ color: colors.danger, fontSize: 13 }}>Keep each one under {MAX_LENGTH} characters.</Text>}

          <BigButton icon="checkmark" label="Save" onPress={() => void save(rows.map((r) => r.text))} busy={saving} disabled={tooLong} />
          <Pressable onPress={resetToDefaults} disabled={saving} accessibilityRole="button" style={{ alignSelf: "center", paddingVertical: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 14, textDecorationLine: "underline" }}>Reset to the standard ones</Text>
          </Pressable>
        </FormScrollView>
      )}
    </View>
  );
}
