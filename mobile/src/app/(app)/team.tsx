import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { Appear } from "@/components/appear";
import { AvatarCircle } from "@/components/avatar-circle";
import { Pressable } from "@/components/pressable";
import { ScreenHeader } from "@/components/screen-header";
import { BigButton } from "@/components/trainer/cards";
import { CARD, FormScrollView, LoadingState, TextField } from "@/components/ui";
import { listTeam, saveTrainerName, saveTrainerPhoto, type Trainer } from "@/data/team";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { colors } from "@/theme";

function TrainerCard({ trainer, isMe, onSaved, index }: { trainer: Trainer; isMe: boolean; onSaved: () => void; index: number }) {
  const [name, setName] = useState(trainer.name ?? "");
  const [photo, setPhoto] = useState(trainer.avatarUrl);
  const [busy, setBusy] = useState<"name" | "photo" | null>(null);
  const changed = name.trim() !== (trainer.name ?? "").trim();

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      hapticError();
      Alert.alert("Photos are off", "Allow access to your photos in Settings to choose one.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setBusy("photo");
    try {
      setPhoto(await saveTrainerPhoto(trainer.id, { uri: asset.uri, mimeType: asset.mimeType }));
      hapticSuccess();
      onSaved();
    } catch (err) {
      hapticError();
      Alert.alert("That didn't go through", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function saveName() {
    setBusy("name");
    try {
      await saveTrainerName(trainer.id, name);
      hapticSuccess();
      onSaved();
    } catch (err) {
      hapticError();
      Alert.alert("That didn't go through", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Appear index={index} style={[CARD, { gap: 12 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Pressable onPress={pickPhoto} disabled={busy !== null} accessibilityRole="button" accessibilityLabel={`Change ${name || "their"} photo`}>
          <AvatarCircle name={name || trainer.email || "?"} avatarUrl={photo} size={64} />
          <View
            style={{ position: "absolute", right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.surface }}
          >
            {busy === "photo" ? <ActivityIndicator size="small" color={colors.accentForeground} /> : <Ionicons name="camera" size={13} color={colors.accentForeground} />}
          </View>
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }} numberOfLines={1}>
            {trainer.name || "No display name"}
            {isMe ? <Text style={{ color: colors.muted, fontWeight: "400" }}> (you)</Text> : null}
          </Text>
          {!!trainer.email && (
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
              {trainer.email}
            </Text>
          )}
        </View>
      </View>
      <View>
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>Display name</Text>
        <TextField value={name} onChangeText={setName} placeholder="e.g. Charlotte (Trainer)" autoCapitalize="words" returnKeyType="done" onSubmitEditing={() => changed && saveName()} />
        {changed && <BigButton label="Save name" icon="checkmark" onPress={saveName} busy={busy === "name"} style={{ marginTop: -4 }} />}
      </View>
    </Appear>
  );
}

/**
 * Trainer: the Team, from Menu — the website's /admin/team in the app.
 * Every trainer's display name and photo (square-cropped), shown on their
 * chat messages and community posts; any trainer can change any of them.
 * Adding or removing a trainer stays on the website.
 */
export default function TeamScreen() {
  const { session } = useAuth();
  const [team, setTeam] = useState<Trainer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTeam(await listTeam());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the team.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Team" subtitle="Each trainer's name and photo, as owners see them in chat and the community." />
      {!team ? (
        <LoadingState error={error} />
      ) : (
        <FormScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48, gap: 12 }}>
          {team.map((t, i) => (
            <TrainerCard key={t.id} trainer={t} isMe={t.id === session?.user.id} onSaved={load} index={i} />
          ))}
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 }}>Tap a photo to change it. Adding or removing a trainer is on the website, under Team.</Text>
        </FormScrollView>
      )}
    </View>
  );
}
