import { ScrollView, Text, View } from "react-native";

import { Appear } from "@/components/appear";
import { ScreenHeader } from "@/components/screen-header";
import { communityGuidelines } from "@/data/community-guidelines";
import { colors } from "@/theme";

/** The Community Guidelines, in the app (they opened the website before). */
export default function GuidelinesScreen() {
  const doc = communityGuidelines;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={doc.heading} subtitle={`Updated ${doc.updated}`} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>
        <Text style={{ color: colors.foreground, fontSize: 15, lineHeight: 22 }}>{doc.intro}</Text>
        {doc.sections.map((s, i) => (
          <Appear key={s.heading} index={i} style={{ marginTop: 24 }}>
            <Text accessibilityRole="header" style={{ color: colors.foreground, fontSize: 18, fontWeight: "700", marginBottom: 8 }}>
              {s.heading}
            </Text>
            {s.blocks.map((b, j) =>
              "p" in b ? (
                <Text key={j} style={{ color: colors.muted, fontSize: 15, lineHeight: 22, marginBottom: 8 }}>
                  {b.p}
                </Text>
              ) : (
                <View key={j} style={{ gap: 6, marginBottom: 8 }}>
                  {b.ul.map((li) => (
                    <View key={li} style={{ flexDirection: "row", gap: 8 }}>
                      <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 22 }}>•</Text>
                      <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 22, flex: 1 }}>{li}</Text>
                    </View>
                  ))}
                </View>
              ),
            )}
          </Appear>
        ))}
      </ScrollView>
    </View>
  );
}
