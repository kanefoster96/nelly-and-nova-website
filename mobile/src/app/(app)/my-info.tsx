import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { ActionSheetIOS, ActivityIndicator, Alert, Linking, Platform, Text, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { Appear } from "@/components/appear";
import { AvatarCircle } from "@/components/avatar-circle";
import { Field, StaticField } from "@/components/form/fields";
import { Pressable } from "@/components/pressable";
import { ScreenHeader } from "@/components/screen-header";
import { FormScrollView, LoadingState, PrimaryButton } from "@/components/ui";
import { getMyProfile, removeMyAvatar, saveMyProfile, uploadMyAvatar, type MyProfile } from "@/data/my-records";
import { hapticError, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { colors } from "@/theme";

type Form = Pick<MyProfile, "ownerName" | "phone" | "address" | "city" | "postcode" | "emergencyContact1" | "emergencyContact2">;

/**
 * My Info, in the app (the website's components/account/AccountDetailsForm.tsx):
 * your photo and name (what chat and community show — for a trainer, their
 * name on the team), phone, and for owners the address we collect from and
 * two emergency contacts. Saved on your own profiles row; Row Level
 * Security stops anyone saving anyone else's.
 */
export default function MyInfoScreen() {
  const { session, profile, isTrainer, refreshProfile } = useAuth();
  const [me, setMe] = useState<MyProfile | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [avatar, setAvatar] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    getMyProfile()
      .then((p) => {
        setMe(p);
        setForm({ ownerName: p.ownerName, phone: p.phone, address: p.address, city: p.city, postcode: p.postcode, emergencyContact1: p.emergencyContact1, emergencyContact2: p.emergencyContact2 });
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (!form || !me) return <LoadingState error={error} />;

  const set = (k: keyof Form) => (v: string) => {
    setForm((f) => (f ? { ...f, [k]: v } : f));
    setSaveState("idle");
  };

  async function save() {
    if (!form) return;
    if (!form.ownerName.trim()) {
      hapticWarning();
      setError("Please enter your name.");
      return;
    }
    setError(null);
    setSaveState("saving");
    try {
      await saveMyProfile(isTrainer ? { ownerName: form.ownerName, phone: form.phone } : form);
      await refreshProfile();
      hapticSuccess();
      setSaveState("saved");
    } catch (e) {
      hapticError();
      setError(e instanceof Error ? e.message : "Couldn't save. Please try again.");
      setSaveState("idle");
    }
  }

  async function pick(from: "camera" | "library") {
    try {
      if (from === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Camera is off", "Allow Nelly & Nova to use the camera in Settings, then try again.", [
            { text: "Not now", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]);
          return;
        }
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.7 };
      const r = from === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (r.canceled || !r.assets[0]) return;
      const a = r.assets[0];
      setPhotoBusy(true);
      const url = await uploadMyAvatar({ uri: a.uri, name: a.fileName ?? "photo.jpg", mimeType: a.mimeType ?? "image/jpeg", size: a.fileSize });
      setAvatar(url);
      await refreshProfile();
      hapticSuccess();
    } catch (e) {
      hapticError();
      setError(e instanceof Error ? e.message : "Couldn't change your photo.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function remove() {
    setPhotoBusy(true);
    try {
      await removeMyAvatar();
      setAvatar(null);
      await refreshProfile();
      hapticSuccess();
    } catch (e) {
      hapticError();
      setError(e instanceof Error ? e.message : "Couldn't remove your photo.");
    } finally {
      setPhotoBusy(false);
    }
  }

  const currentAvatar = avatar === undefined ? profile?.avatarUrl ?? null : avatar;

  function photoMenu() {
    const choices = ["Take photo", "Choose from library", ...(currentAvatar ? ["Remove photo"] : []), "Cancel"];
    const run = (i: number) => {
      if (choices[i] === "Take photo") void pick("camera");
      else if (choices[i] === "Choose from library") void pick("library");
      else if (choices[i] === "Remove photo") void remove();
    };
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: choices, cancelButtonIndex: choices.length - 1, destructiveButtonIndex: currentAvatar ? 2 : undefined, title: "Profile photo" },
        run,
      );
    } else {
      Alert.alert("Profile photo", undefined, [
        { text: "Take photo", onPress: () => run(0) },
        { text: "Choose from library", onPress: () => run(1) },
        ...(currentAvatar ? [{ text: "Remove photo", style: "destructive" as const, onPress: () => run(2) }] : []),
      ]);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="My Info" />
      <FormScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48 }}>
        <Appear style={{ alignItems: "center", marginBottom: 20 }}>
          <Pressable onPress={photoMenu} accessibilityRole="button" accessibilityLabel="Change your profile photo" disabled={photoBusy}>
            <View>
              <AvatarCircle name={form.ownerName || session?.user.email || "?"} avatarUrl={currentAvatar} size={96} />
              <View style={{ position: "absolute", right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.background }}>
                {photoBusy ? <ActivityIndicator size="small" color={colors.accentForeground} /> : <Ionicons name="camera" size={16} color={colors.accentForeground} />}
              </View>
            </View>
          </Pressable>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 10 }}>{currentAvatar ? "Tap to change your photo" : "Tap to add a photo"}</Text>
        </Appear>

        <Appear index={1} style={{ gap: 18 }}>
          <Field
            label={isTrainer ? "Display name" : "Full name"}
            required
            value={form.ownerName}
            onChangeText={set("ownerName")}
            autoCapitalize="words"
            textContentType="name"
            hint={isTrainer ? "Shown on your chat messages and community posts, with the trainer tick." : "Shown on your chat messages with us."}
          />
          <StaticField label="Email" value={me.email || session?.user.email || ""} icon="mail-outline" />
          <Field label="Phone" value={form.phone} onChangeText={set("phone")} keyboardType="phone-pad" textContentType="telephoneNumber" />
          {!isTrainer && (
            <>
              <Field label="Address" value={form.address} onChangeText={set("address")} placeholder="Street address" textContentType="streetAddressLine1" autoCapitalize="words" hint="Where we collect your dog from and drop them back." />
              <Field label="Town / city" value={form.city} onChangeText={set("city")} textContentType="addressCity" autoCapitalize="words" />
              <Field label="Postcode" value={form.postcode} onChangeText={set("postcode")} textContentType="postalCode" autoCapitalize="characters" />
              <Field label="Emergency contact 1" value={form.emergencyContact1} onChangeText={set("emergencyContact1")} placeholder="Name & number" />
              <Field label="Emergency contact 2" value={form.emergencyContact2} onChangeText={set("emergencyContact2")} placeholder="Name & number" />
            </>
          )}
          {error && <Text style={{ color: colors.danger, fontSize: 14 }}>{error}</Text>}
          <PrimaryButton title={saveState === "saved" ? "Saved" : "Save changes"} onPress={save} loading={saveState === "saving"} />
        </Appear>
      </FormScrollView>
    </View>
  );
}
