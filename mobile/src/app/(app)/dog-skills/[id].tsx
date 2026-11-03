import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";

import { Appear } from "@/components/appear";
import { Pressable } from "@/components/pressable";
import { ScreenHeader } from "@/components/screen-header";
import { BigButton } from "@/components/trainer/cards";
import { CARD, LoadingState, Tag } from "@/components/ui";
import { getDogProgress, pillarLevel, saveDogSkills, type DogProgress } from "@/data/reports";
import { hapticError, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { colors } from "@/theme";

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
}

/**
 * Trainer: tick off the skills a dog has learnt, pillar by pillar and level
 * by level — the Kanvas app's progress sheet, for dogs. Saved together; the
 * owner sees the new levels in their Homework.
 */
export default function DogSkillsScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [progress, setProgress] = useState<DogProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      setProgress(await getDogProgress(String(id)));
      setTicks({});
    } catch {
      setError("Couldn't load the skills.");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!progress) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Skills" />
        <LoadingState error={error} />
      </View>
    );
  }

  const isOn = (skillId: string) => ticks[skillId] ?? Boolean(progress.learnt[skillId]);
  const changes = Object.fromEntries(Object.entries(ticks).filter(([k, v]) => v !== Boolean(progress.learnt[k])));
  const dirty = Object.keys(changes).length > 0;

  async function save() {
    setSaving(true);
    try {
      await saveDogSkills(String(id), changes);
      hapticSuccess();
      await load();
    } catch (err) {
      hapticError();
      Alert.alert("Couldn't save", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={name ? `${name}'s skills` : "Skills"} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 48, gap: 14 }}>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>Tick the skills as they land. Finishing a level moves them up to the next.</Text>
        {progress.pillars.map((p, pi) => {
          const learntNow: Record<string, string> = {};
          for (const s of p.skills) if (isOn(s.id)) learntNow[s.id] = progress.learnt[s.id] ?? "now";
          const count = Object.keys(learntNow).length;
          const levels = [...new Set(p.skills.map((s) => s.level))].sort((a, b) => a - b);
          return (
            <Appear key={p.id} index={pi} style={CARD}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700", flex: 1 }}>{p.name}</Text>
                <Tag label={`Level ${pillarLevel(p, learntNow)}`} />
              </View>
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
                Skills ({count} of {p.skills.length})
              </Text>
              {levels.map((lvl) => (
                <View key={lvl} style={{ marginTop: 12 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}>LEVEL {lvl}</Text>
                  {p.skills
                    .filter((s) => s.level === lvl)
                    .map((s) => {
                      const on = isOn(s.id);
                      return (
                        <Pressable
                          key={s.id}
                          onPress={() => {
                            hapticSelection();
                            setTicks((t) => ({ ...t, [s.id]: !on }));
                          }}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }}
                          style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 }}
                        >
                          <Ionicons name={on ? "checkbox" : "square-outline"} size={22} color={on ? colors.success : colors.muted} />
                          <Text style={{ color: colors.foreground, fontSize: 15, flex: 1 }}>{s.name}</Text>
                          {on && progress.learnt[s.id] && <Text style={{ color: colors.muted, fontSize: 12 }}>{day(progress.learnt[s.id])}</Text>}
                        </Pressable>
                      );
                    })}
                </View>
              ))}
            </Appear>
          );
        })}
        <BigButton label={saving ? "Saving…" : "Save"} onPress={save} disabled={!dirty} busy={saving} />
      </ScrollView>
    </View>
  );
}
