import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Alert, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { Screen } from "@/components/Screen";
import { Avatar, Button, Card, Muted, Pill, SectionTitle } from "@/components/ui";
import { getMyDogs } from "@/data/dogs";
import { getDogProfile } from "@/data/reports";
import { supabase } from "@/lib/supabase";
import { useAsync } from "@/lib/useAsync";
import { colors, radius, space } from "@/theme";

function Skills() {
  // TODO(backend): per-dog skills/level once dog_skills exists — sample for now.
  const { data: dog } = useAsync(getDogProfile);
  if (!dog) return null;
  return (
    <>
      <SectionTitle>{dog.name}'s progress</SectionTitle>
      <Card>
        <Text style={styles.level}>Level {dog.level} · {dog.sessions} sessions</Text>
        {dog.skills.map((s) => (
          <View key={s.label} style={styles.skill}>
            <Text style={styles.skillLabel}>{s.label}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${(s.level / s.of) * 100}%` }]} />
            </View>
          </View>
        ))}
      </Card>
    </>
  );
}

export default function Profile() {
  const { session, profile, isTrainer } = useAuth();
  const userId = session?.user.id ?? "";
  const { data: dogs, error, loading, reload } = useAsync(() => getMyDogs(userId), [userId]);
  const name = profile?.ownerName || session?.user.email || "Member";

  function signOut() {
    Alert.alert("Sign out?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => supabase.auth.signOut() },
    ]);
  }

  return (
    <Screen refreshing={loading && !!dogs} onRefresh={reload}>
      <View style={styles.header}>
        <Avatar name={name} size={72} />
        <Text style={styles.name}>{name}</Text>
        <Muted>{session?.user.email}</Muted>
        <Pill label={isTrainer ? "Trainer" : "Member"} tone={isTrainer ? "accent" : "default"} />
      </View>

      {!isTrainer ? (
        <>
          <SectionTitle>Your dogs</SectionTitle>
          {error ? <Muted>Couldn't load your dogs: {error.message}</Muted> : null}
          {dogs?.length === 0 ? <Muted>No dogs on your account yet.</Muted> : null}
          {dogs?.map((d) => (
            <Card key={d.id} style={styles.dog}>
              <Avatar uri={d.photoUrl} name={d.name} size={48} />
              <Text style={styles.dogName}>{d.name}</Text>
            </Card>
          ))}
          <Skills />
        </>
      ) : null}

      <Button variant="secondary" label="Sign out" onPress={signOut} />

      {/* Build/update info — handy for checking which OTA update a tester is on. */}
      <View style={styles.meta}>
        <Text style={styles.metaText}>
          Version {Constants.expoConfig?.version} · {Updates.channel ?? "dev"}
        </Text>
        <Text style={styles.metaText}>
          {Updates.isEmbeddedLaunch ? "Built-in bundle" : `Update ${Updates.updateId?.slice(0, 8)}`}
          {Updates.createdAt ? ` · ${Updates.createdAt.toLocaleDateString("en-GB")}` : ""}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", gap: space.xs, paddingVertical: space.md },
  name: { color: colors.paper, fontSize: 24, fontWeight: "800", marginTop: space.sm },
  dog: { flexDirection: "row", alignItems: "center", gap: space.md },
  dogName: { color: colors.paper, fontSize: 17, fontWeight: "600" },
  level: { color: colors.paper, fontSize: 16, fontWeight: "700" },
  skill: { gap: 6 },
  skillLabel: { color: colors.paperDim, fontSize: 14 },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.inkSoft, overflow: "hidden" },
  fill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.accent },
  meta: { marginTop: space.lg, alignItems: "center", gap: 2 },
  metaText: { color: colors.paperDim, fontSize: 12 },
});
