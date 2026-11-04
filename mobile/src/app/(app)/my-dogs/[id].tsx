import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";

import { Appear } from "@/components/appear";
import { Checkbox, Choice, DateField, Field, isoToUk, SelectField, YES_NO } from "@/components/form/fields";
import { Pressable } from "@/components/pressable";
import { ScreenHeader } from "@/components/screen-header";
import { CARD, FormScrollView, LoadingState, PrimaryButton } from "@/components/ui";
import {
  ageFromDob,
  deleteDocument,
  documentLink,
  DOCUMENT_KINDS,
  getMyDog,
  listDocuments,
  listWaivers,
  saveDog,
  uploadDocument,
  uploadDogPhoto,
  type DocumentKind,
  type DogDocument,
  type DogRecord,
  type WaiverRecord,
} from "@/data/my-records";
import { hapticError, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { colors } from "@/theme";

const SEXES = [
  { value: "Male", label: "Male" },
  { value: "Male (neutered)", label: "Male (neutered)" },
  { value: "Female", label: "Female" },
  { value: "Female (spayed)", label: "Female (spayed)" },
];

const SECTION = { color: colors.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, marginTop: 28, marginBottom: 12 } as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * One of the owner's dogs, in the app (the website's DogRecordView, owner
 * mode): photo, details, health & vet, documents (vaccination record,
 * insurance, vet letters: kept privately) and the signed consent & waiver.
 */
export default function MyDogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [dog, setDog] = useState<DogRecord | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getMyDog(id)
        .then((d) => {
          if (cancelled) return;
          setDog(d);
          setState(d ? "ready" : "missing");
        })
        .catch((e: Error) => !cancelled && setError(e.message));
      return () => {
        cancelled = true;
      };
    }, [id]),
  );

  if (state === "missing") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Dog not found" subtitle="It may have been removed, or it isn't on this account." />
      </View>
    );
  }
  if (!dog) return <LoadingState error={error} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader />
      <FormScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 56 }}>
        <Header dog={dog} onPhoto={(url) => setDog({ ...dog, photoUrl: url })} />
        <WaiverCard dog={dog} />
        <DetailsCard key={dog.id} dog={dog} onSaved={setDog} />
        <DocumentsCard dog={dog} />
      </FormScrollView>
    </View>
  );
}

function Header({ dog, onPhoto }: { dog: DogRecord; onPhoto: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const age = ageFromDob(dog.dateOfBirth);

  async function change() {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
      if (r.canceled || !r.assets[0]) return;
      const a = r.assets[0];
      setBusy(true);
      onPhoto(await uploadDogPhoto(dog, { uri: a.uri, name: a.fileName ?? "photo.jpg", mimeType: a.mimeType ?? "image/jpeg", size: a.fileSize }));
      hapticSuccess();
    } catch (e) {
      hapticError();
      Alert.alert("Couldn't change the photo", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Appear style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 4 }}>
      <Pressable onPress={change} accessibilityRole="button" accessibilityLabel={`Change ${dog.name}'s photo`}>
        <View style={{ width: 88, height: 88, borderRadius: 44, overflow: "hidden", backgroundColor: "rgba(245,245,242,0.1)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(245,245,242,0.5)" }}>
          {dog.photoUrl ? <Image source={dog.photoUrl} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <Text style={{ color: colors.foreground, fontSize: 30, fontWeight: "600" }}>{dog.name.charAt(0).toUpperCase()}</Text>}
          {busy && (
            <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={colors.foreground} />
            </View>
          )}
        </View>
        <View style={{ position: "absolute", right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.background }}>
          <Ionicons name="camera" size={14} color={colors.accentForeground} />
        </View>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: "800" }} numberOfLines={1}>
          {dog.name}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 14, marginTop: 2 }}>{[dog.breed, age, dog.sex].filter(Boolean).join(" · ") || "Add their details below"}</Text>
      </View>
    </Appear>
  );
}

function WaiverCard({ dog }: { dog: DogRecord }) {
  const router = useRouter();
  const [waivers, setWaivers] = useState<WaiverRecord[] | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listWaivers(dog.id)
        .then(async (list) => {
          if (cancelled) return;
          setWaivers(list);
          const latest = list[0];
          if (latest?.signaturePath) {
            const url = await documentLink(latest.signaturePath, 600).catch(() => null);
            if (!cancelled) setSignature(url);
          }
        })
        .catch(() => !cancelled && setWaivers([]));
      return () => {
        cancelled = true;
      };
    }, [dog.id]),
  );

  const latest = waivers?.[0];
  const register = () => router.push({ pathname: "/register/[dogId]", params: { dogId: dog.id } } as never);

  return (
    <>
      <Text style={SECTION}>Consent &amp; waiver</Text>
      {waivers === null ? (
        <View style={CARD}>
          <ActivityIndicator color={colors.muted} />
        </View>
      ) : latest ? (
        <View style={[CARD, { gap: 12 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={{ color: colors.foreground, fontSize: 15, flex: 1 }}>
              Signed by {latest.signedName} on {formatDate(latest.signedAt)}
            </Text>
          </View>
          {signature && (
            <View style={{ backgroundColor: "#ffffff", borderRadius: 10, padding: 8, height: 90 }}>
              <Image source={{ uri: signature }} style={{ width: "100%", height: "100%" }} contentFit="contain" accessibilityLabel={`Signature of ${latest.signedName}`} />
            </View>
          )}
          <Pressable onPress={register} hitSlop={8} style={{ alignSelf: "flex-start" }}>
            <Text style={{ color: colors.muted, fontSize: 13, textDecorationLine: "underline" }}>Sign an updated form</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[CARD, { gap: 14, borderColor: "rgba(245,158,11,0.4)", backgroundColor: "rgba(245,158,11,0.06)" }]}>
          <Text style={{ color: colors.foreground, fontSize: 15, lineHeight: 21 }}>Not signed yet. This is needed before {dog.name}&apos;s first session.</Text>
          <PrimaryButton title={`Register ${dog.name}`} onPress={register} />
        </View>
      )}
    </>
  );
}

function DetailsCard({ dog, onSaved }: { dog: DogRecord; onSaved: (d: DogRecord) => void }) {
  const [f, setF] = useState(dog);
  const [dobText, setDobText] = useState(isoToUk(dog.dateOfBirth));
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const set =
    <K extends keyof DogRecord>(k: K) =>
    (v: DogRecord[K]) => {
      setF((x) => ({ ...x, [k]: v }));
      setState("idle");
    };

  async function save() {
    if (!f.name.trim()) {
      hapticWarning();
      return setError("Your dog needs a name.");
    }
    if (dobText.trim() && !f.dateOfBirth) {
      hapticWarning();
      return setError("Enter the date of birth as DD/MM/YYYY.");
    }
    if (f.dateOfBirth && f.dateOfBirth > new Date().toISOString().slice(0, 10)) {
      hapticWarning();
      return setError("Date of birth can't be in the future.");
    }
    setError(null);
    setState("saving");
    try {
      const { id: _id, accountId: _a, waiverSignedAt: _w, ...patch } = f;
      void _id;
      void _a;
      void _w;
      await saveDog(dog.id, patch);
      onSaved(f);
      hapticSuccess();
      setState("saved");
    } catch (e) {
      hapticError();
      setError(e instanceof Error ? e.message : "Couldn't save. Please try again.");
      setState("idle");
    }
  }

  return (
    <>
      <Text style={SECTION}>Details</Text>
      <View style={{ gap: 18 }}>
        <Field label="Name" required value={f.name} onChangeText={set("name")} autoCapitalize="words" />
        <Field label="Breed" value={f.breed} onChangeText={set("breed")} autoCapitalize="words" />
        <SelectField label="Sex" options={SEXES} value={f.sex} onChange={set("sex")} />
        <DateField
          label="Date of birth"
          text={dobText}
          onChange={(text, iso) => {
            setDobText(text);
            set("dateOfBirth")(iso);
          }}
        />
        <Field label="Microchip number" value={f.microchip} onChangeText={set("microchip")} keyboardType="number-pad" />
      </View>

      <Text style={SECTION}>Health</Text>
      <View style={{ gap: 18 }}>
        <Checkbox checked={f.vaccinationsConfirmed} onToggle={() => set("vaccinationsConfirmed")(!f.vaccinationsConfirmed)}>
          Vaccinations are up to date
        </Checkbox>
        <Choice label="Kennel cough vaccination?" options={YES_NO} columns={2} value={f.kennelCough === null ? "" : f.kennelCough ? "yes" : "no"} onChange={(v) => set("kennelCough")(v === "yes")} />
        <Field label="Medical conditions" multiline value={f.medicalConditions} onChangeText={set("medicalConditions")} placeholder="None" />
        <Field label="Allergies" multiline value={f.allergies} onChangeText={set("allergies")} placeholder="None" />
      </View>

      <Text style={SECTION}>Vet</Text>
      <View style={{ gap: 18 }}>
        <Field label="Vet's name / practice" value={f.vetName} onChangeText={set("vetName")} autoCapitalize="words" />
        <Field label="Vet's phone" value={f.vetPhone} onChangeText={set("vetPhone")} keyboardType="phone-pad" />
        <Field label="Vet's address" value={f.vetAddress} onChangeText={set("vetAddress")} autoCapitalize="words" />
        <Field label="Anything else we should know?" multiline value={f.notes} onChangeText={set("notes")} />
        {error && <Text style={{ color: colors.danger, fontSize: 14 }}>{error}</Text>}
        <PrimaryButton title={state === "saved" ? "Saved" : "Save details"} onPress={save} loading={state === "saving"} />
      </View>
    </>
  );
}

function DocumentsCard({ dog }: { dog: DogRecord }) {
  const [docs, setDocs] = useState<DogDocument[] | null>(null);
  const [kind, setKind] = useState<DocumentKind>("vaccination");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setDocs(await listDocuments(dog.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load documents.");
      setDocs([]);
    }
  }, [dog.id]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  async function add(from: "photos" | "files") {
    setError(null);
    try {
      let file: { uri: string; name: string; mimeType: string; size?: number | null } | null = null;
      if (from === "files") {
        const r = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
        if (r.canceled || !r.assets[0]) return;
        const a = r.assets[0];
        file = { uri: a.uri, name: a.name, mimeType: a.mimeType ?? "application/pdf", size: a.size };
      } else {
        const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
        if (r.canceled || !r.assets[0]) return;
        const a = r.assets[0];
        file = { uri: a.uri, name: a.fileName ?? "document.jpg", mimeType: a.mimeType ?? "image/jpeg", size: a.fileSize };
      }
      if (file.size && file.size > 10 * 1024 * 1024) throw new Error("That file is over 10 MB — please choose a smaller one.");
      setBusy(true);
      await uploadDocument(file, { kind, dogId: dog.id, record: true });
      await refresh();
      hapticSuccess();
    } catch (e) {
      hapticError();
      setError(e instanceof Error ? e.message : "Couldn't upload that.");
    } finally {
      setBusy(false);
    }
  }

  async function open(doc: DogDocument) {
    try {
      await WebBrowser.openBrowserAsync(await documentLink(doc.path));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the file.");
    }
  }

  function remove(doc: DogDocument) {
    Alert.alert(`Delete “${doc.fileName}”?`, undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDocument(doc);
            await refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Couldn't delete it.");
          }
        },
      },
    ]);
  }

  const label = (k: DocumentKind) => (k === "waiver" ? "Signed waiver" : DOCUMENT_KINDS.find((x) => x.value === k)?.label ?? "Document");

  return (
    <>
      <Text style={SECTION}>Documents</Text>
      <Text style={{ color: colors.muted, fontSize: 13, marginTop: -4, marginBottom: 12 }}>Vaccination records, insurance and vet letters, kept privately on your account.</Text>
      <View style={[CARD, { padding: 0, overflow: "hidden" }]}>
        {docs === null ? (
          <ActivityIndicator color={colors.muted} style={{ padding: 16 }} />
        ) : docs.length === 0 ? (
          <Text style={{ color: colors.muted, padding: 16 }}>No documents yet.</Text>
        ) : (
          docs.map((d, i) => (
            <View key={d.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
              <Ionicons name={d.contentType.startsWith("image/") ? "image-outline" : "document-text-outline"} size={20} color={colors.muted} />
              <Pressable onPress={() => open(d)} style={{ flex: 1 }} accessibilityRole="link">
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
                  {d.fileName}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                  {label(d.kind)} · {formatDate(d.createdAt)}
                </Text>
              </Pressable>
              <Pressable onPress={() => remove(d)} hitSlop={10} accessibilityLabel={`Delete ${d.fileName}`}>
                <Ionicons name="trash-outline" size={18} color={colors.muted} />
              </Pressable>
            </View>
          ))
        )}
      </View>
      <View style={{ marginTop: 16, gap: 12 }}>
        <SelectField label="Add a document" options={DOCUMENT_KINDS} value={kind} onChange={(v) => setKind(v as DocumentKind)} />
        {busy ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 8 }}>
            <ActivityIndicator color={colors.foreground} />
            <Text style={{ color: colors.muted }}>Uploading…</Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <SmallButton icon="images-outline" label="From Photos" onPress={() => add("photos")} />
            <SmallButton icon="document-outline" label="From Files" onPress={() => add("files")} />
          </View>
        )}
        <Text style={{ color: colors.muted, fontSize: 12 }}>Photos or PDFs, up to 10 MB.</Text>
        {error && <Text style={{ color: colors.danger, fontSize: 14 }}>{error}</Text>}
      </View>
    </>
  );
}

function SmallButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", height: 46, borderRadius: 23, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" }}
    >
      <Ionicons name={icon} size={18} color={colors.foreground} />
      <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}
