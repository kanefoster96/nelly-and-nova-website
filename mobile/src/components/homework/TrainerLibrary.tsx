import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/Screen";
import { Card, Loading, Muted, SectionTitle } from "@/components/ui";
import { categoryDrillCount, getLibrary } from "@/data/homework";
import { useAsync } from "@/lib/useAsync";
import { colors, space } from "@/theme";

export function TrainerLibrary() {
  const { data: library } = useAsync(getLibrary);
  const [open, setOpen] = useState<string | null>(null);

  if (!library) return <Loading />;

  return (
    <Screen>
      <Muted>Drill library. Tap a category to see its levels and drills.</Muted>
      {library.map((pillar) => (
        <View key={pillar.id} style={styles.pillar}>
          <SectionTitle>{pillar.name}</SectionTitle>
          <Muted>{pillar.blurb}</Muted>
          {pillar.categories.map((cat) => {
            const expanded = open === cat.id;
            return (
              <Card key={cat.id} onPress={() => setOpen(expanded ? null : cat.id)}>
                <View style={styles.row}>
                  <Text style={styles.catName}>{cat.name}</Text>
                  <Text style={styles.count}>{categoryDrillCount(cat)} drills</Text>
                  <SymbolView
                    name={expanded ? { ios: "chevron.up", android: "expand_less" } : { ios: "chevron.down", android: "expand_more" }}
                    tintColor={colors.paperDim}
                    size={14}
                  />
                </View>
                {expanded
                  ? cat.levels.map((lvl) => (
                      <View key={lvl.level} style={styles.level}>
                        <Text style={styles.levelName}>Level {lvl.level}</Text>
                        {lvl.drills.map((d) => (
                          <Pressable
                            key={d.id}
                            style={({ pressed }) => [styles.drill, pressed && { opacity: 0.6 }]}
                            onPress={() => router.push({ pathname: "/homework/drill/[id]", params: { id: d.id } })}
                          >
                            <Text style={styles.drillText}>{d.name}</Text>
                            <SymbolView name={{ ios: "chevron.right", android: "chevron_right" }} tintColor={colors.paperDim} size={12} />
                          </Pressable>
                        ))}
                      </View>
                    ))
                  : null}
              </Card>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pillar: { gap: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  catName: { color: colors.paper, fontSize: 17, fontWeight: "600", flex: 1 },
  count: { color: colors.paperDim, fontSize: 13 },
  level: { gap: 4, paddingTop: space.sm },
  levelName: { color: colors.paperDim, fontSize: 13, fontWeight: "700" },
  drill: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: space.sm },
  drillText: { color: colors.paper, fontSize: 15, flex: 1 },
});
