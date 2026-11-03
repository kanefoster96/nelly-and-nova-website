import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Fragment, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { NavDivider, NavList } from "@/components/nav-row";
import { PageTitle } from "@/components/page-title";
import { ScreenHeader } from "@/components/screen-header";
import { Pressable } from "@/components/pressable";
import { LoadingState } from "@/components/ui";
import { categoryDrillCount, getLibrary } from "@/data/homework";
import { useBarInset, useBarScroll, useTopBarInset } from "@/lib/floating-bar";
import { hapticSelection } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { useAsync } from "@/lib/useAsync";
import { colors } from "@/theme";

const SUBTITLE = "The drill library. Tap a category to see its levels, and a drill to open its how-to.";

/**
 * Trainer: the drill library — pillars, categories (tap to expand), levels
 * and drills. `pushed`: opened from Menu, as a page over the tabs with a
 * back button (app/(app)/library.tsx), rather than as a tab.
 */
export function TrainerLibrary({ pushed = false }: { pushed?: boolean }) {
  const router = useRouter();
  const { data: library, error } = useAsync(getLibrary);
  const [open, setOpen] = useState<string | null>(null);
  const barScroll = useBarScroll();
  const barInset = useBarInset();
  const topInset = useTopBarInset();

  if (!library) {
    const loading = <LoadingState error={error ? "Could not load the library." : null} />;
    return pushed ? (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Homework" />
        {loading}
      </View>
    ) : (
      loading
    );
  }

  const list = (
    <ScrollView
      {...(pushed ? {} : barScroll)}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: pushed ? 0 : topInset + 8, paddingBottom: pushed ? 48 : barInset }}
    >
      {pushed ? (
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21, paddingHorizontal: 20 }}>{SUBTITLE}</Text>
      ) : (
        <PageTitle title="Homework" subtitle={SUBTITLE} style={{ paddingHorizontal: 20 }} />
      )}
      {library.map((pillar) => (
        <View key={pillar.id}>
          <Text style={{ color: colors.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginTop: 24, marginBottom: 8, paddingHorizontal: 20 }}>
            {pillar.name} · {pillar.blurb}
          </Text>
          <NavList>
            {pillar.categories.map((cat, i) => {
              const expanded = open === cat.id;
              return (
                <Fragment key={cat.id}>
                  {i > 0 && <NavDivider />}
                  <Pressable
                    onPress={() => {
                      hapticSelection();
                      animateListChange();
                      setOpen(expanded ? null : cat.id);
                    }}
                    style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 }}
                  >
                    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(245,245,242,0.06)", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="school-outline" size={18} color={colors.muted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "500" }}>{cat.name}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                        {categoryDrillCount(cat)} drills · {cat.levels.length} levels
                      </Text>
                    </View>
                    <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
                  </Pressable>
                  {expanded &&
                    cat.levels.map((lvl) => (
                      <View key={lvl.level} style={{ paddingLeft: 62, paddingRight: 16, paddingBottom: 8 }}>
                        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginTop: 4, marginBottom: 2 }}>LEVEL {lvl.level}</Text>
                        {lvl.drills.map((d) => (
                          <Pressable
                            key={d.id}
                            onPress={() => router.push({ pathname: "/drill/[id]", params: { id: d.id } })}
                            style={{ flexDirection: "row", alignItems: "center", paddingVertical: 9, gap: 8 }}
                          >
                            <Text style={{ color: colors.foreground, fontSize: 14, flex: 1 }}>{d.name}</Text>
                            <Ionicons name="chevron-forward" size={15} color={colors.muted} />
                          </Pressable>
                        ))}
                      </View>
                    ))}
                </Fragment>
              );
            })}
          </NavList>
        </View>
      ))}
    </ScrollView>
  );

  if (!pushed) return list;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Homework" />
      {list}
    </View>
  );
}
