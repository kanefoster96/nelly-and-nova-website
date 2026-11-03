import { Text, View } from "react-native";

import { CARD } from "@/components/ui";
import { pillarLevel, type DogProgress } from "@/data/reports";
import { colors } from "@/theme";

const GREEN_EDGE = "rgba(34,197,94,0.35)";
const GREEN_FILL = "rgba(34,197,94,0.1)";

/**
 * A dog's Skills & levels — the Kanvas app's class-pass-progress, for dogs:
 * each pillar's level, the skills ticked off so far (green) and the next few
 * to learn. The trainer ticks them off; the member reads them here.
 */
export function DogProgressCard({ progress, dogName }: { progress: DogProgress; dogName?: string }) {
  return (
    <View style={CARD}>
      <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}>{dogName ? `${dogName}'s skills & levels` : "Skills & levels"}</Text>
      {progress.pillars.map((p) => {
        const done = p.skills.filter((s) => progress.learnt[s.id]);
        const next = p.skills.filter((s) => !progress.learnt[s.id]).slice(0, 3);
        const pct = p.skills.length ? done.length / p.skills.length : 0;
        return (
          <View key={p.id} style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>{p.name}</Text>
            <Text style={{ color: colors.foreground, fontSize: 16, marginTop: 4 }}>
              ⭐ <Text style={{ fontWeight: "700" }}>Level {pillarLevel(p, progress.learnt)}</Text>
            </Text>
            <View style={{ marginTop: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.foreground, fontSize: 14 }}>Skills</Text>
                <Text style={{ color: colors.muted, fontSize: 14 }}>
                  {done.length} of {p.skills.length}
                </Text>
              </View>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, marginTop: 6, overflow: "hidden" }}>
                <View style={{ width: `${Math.round(pct * 100)}%`, height: "100%", backgroundColor: colors.success, borderRadius: 4 }} />
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {done.map((s) => (
                  <Text key={s.id} style={{ color: colors.success, fontSize: 12, borderWidth: 1, borderColor: GREEN_EDGE, backgroundColor: GREEN_FILL, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" }}>
                    ✓ {s.name}
                  </Text>
                ))}
                {next.map((s) => (
                  <Text key={s.id} style={{ color: colors.muted, fontSize: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                    {s.name}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        );
      })}
      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 14 }}>Assessed and ticked off by your trainer.</Text>
    </View>
  );
}
