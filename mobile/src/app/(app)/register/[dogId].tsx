import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, Linking, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/auth/AuthProvider";
import { Appear } from "@/components/appear";
import { Checkbox, Choice, DateField, Field, isoToUk, PhoneRow, SelectField, YES_NO } from "@/components/form/fields";
import { SignaturePad } from "@/components/form/signature-pad";
import { Pressable } from "@/components/pressable";
import { CARD, PrimaryButton } from "@/components/ui";
import { getMyDog, getMyProfile, uploadDocument, type PickedFile } from "@/data/my-records";
import {
  clearDraft,
  emptyWaiver,
  loadDraft,
  REGISTER_STEPS,
  REVIEW_STEP,
  saveDraft,
  SIGN_STEP,
  splitPhone,
  submitRegistration,
  todayISO,
  validateStep,
  type WaiverData,
} from "@/data/register";
import { countryOptions, dialCodes, genderOptions, waiverAgreement, waiverClauses, waiverTitle } from "@/data/waiver-terms";
import { hapticError, hapticSelection, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { colors, GLASS_BORDER } from "@/theme";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Errors = Record<string, string>;
type SetFn = (key: keyof WaiverData) => (value: string) => void;

/**
 * Register a dog: the Final Consent & Waiver, in the app. Kanvas's
 * register-dancer wizard (details → emergency contacts → medical → waiver)
 * for a dog, with the website's form's steps, fields and checks
 * (components/waiver/WaiverForm.tsx): about you, your address, the dog's
 * basics, vaccinations, health and vet, the consent & waiver, then a check
 * of every answer before signing. Progress is saved on this phone after
 * each step (and if they leave the app), so they can stop and come back.
 *
 * Opened from the Profile tab's "Register {dog}" card, the set-up
 * checklist, and the register reminder notification ("/register"). The id
 * is the dog's, or "new" for a dog not on the account yet.
 */
export default function RegisterDogScreen() {
  const { dogId: rawId } = useLocalSearchParams<{ dogId: string }>();
  const dogKey = rawId && UUID.test(rawId) ? rawId : "new";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const scrollRef = useRef<ScrollView>(null);

  const [data, setData] = useState<WaiverData>(emptyWaiver);
  const [dobText, setDobText] = useState("");
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [ready, setReady] = useState(false);
  const [restored, setRestored] = useState(false);
  const [alreadySigned, setAlreadySigned] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedDogId, setSavedDogId] = useState<string | null>(null);

  // A saved draft, or what we already know from the account and the dog.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const dog = dogKey === "new" ? null : await getMyDog(dogKey).catch(() => null);
      if (cancelled) return;
      if (dog?.waiverSignedAt) setAlreadySigned(dog.waiverSignedAt);
      const draft = loadDraft(userId, dogKey);
      if (draft) {
        setData(draft.data);
        setDobText(draft.dobText || isoToUk(draft.data.dob));
        setStep(draft.step);
        setCompleted(draft.completed);
        setRestored(true);
        setReady(true);
        return;
      }
      const profile = await getMyProfile().catch(() => null);
      if (cancelled) return;
      const [first, ...rest] = (profile?.ownerName ?? "").trim().split(/\s+/);
      const em1 = splitPhone(profile?.emergencyContact1 ?? "", dialCodes);
      const em2 = splitPhone(profile?.emergencyContact2 ?? "", dialCodes);
      const vet = splitPhone(dog?.vetPhone ?? "", dialCodes);
      const next: WaiverData = {
        ...emptyWaiver,
        firstName: first ?? "",
        lastName: rest.join(" "),
        email: session?.user.email ?? profile?.email ?? "",
        em1Code: em1.code,
        em1: em1.number,
        em2Code: em2.code,
        em2: em2.number,
        country: countryOptions.some((c) => c.value && c.value === profile?.country) ? profile!.country : profile?.country ? "Other" : "",
        address: profile?.address ?? "",
        city: profile?.city ?? "",
        postcode: profile?.postcode ?? "",
        clientName: profile?.ownerName ?? "",
        signDate: todayISO(),
        dogId: dog?.id ?? "",
        dogName: dog?.name ?? "",
        breed: dog?.breed ?? "",
        dob: dog?.dateOfBirth ?? "",
        gender: ["Male", "Female"].find((g) => dog?.sex.startsWith(g)) ?? "",
        microchip: dog?.microchip ?? "",
        vetName: dog?.vetName ?? "",
        vetCode: vet.code,
        vetPhone: vet.number,
        vetAddress: dog?.vetAddress ?? "",
      };
      setData(next);
      setDobText(isoToUk(next.dob));
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, dogKey, session?.user.email]);

  // Saved if they leave mid-step too (switch apps, lock the phone), not only on Next.
  const latest = useRef({ step, completed, data, dobText, status, ready });
  latest.current = { step, completed, data, dobText, status, ready };
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      const l = latest.current;
      if (state !== "active" && l.status === "idle" && l.ready && userId) {
        saveDraft(userId, dogKey, { step: l.step, completed: l.completed, data: l.data, dobText: l.dobText });
      }
    });
    return () => sub.remove();
  }, [userId, dogKey]);

  const persist = useCallback(
    (nextStep: number, nextCompleted: number[], d = data) => {
      if (!userId) return;
      saveDraft(userId, dogKey, { step: nextStep, completed: nextCompleted, data: d, dobText });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    },
    [userId, dogKey, data, dobText],
  );

  const set: SetFn = (key) => (value) => {
    setData((d) => ({ ...d, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };
  const toggle = (key: keyof WaiverData) => {
    setData((d) => ({ ...d, [key]: !d[key] }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };

  function check(s: number): Errors {
    const e = validateStep(s, data, uploading);
    if (s === 2 && dobText.trim() && !data.dob) e.dob = "Enter the date as DD/MM/YYYY.";
    return e;
  }

  const toTop = () => requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));

  function next() {
    const e = check(step);
    if (Object.values(e).some(Boolean)) {
      hapticWarning();
      setErrors(e);
      return;
    }
    const nextCompleted = Array.from(new Set([...completed, step]));
    const ns = Math.min(step + 1, REGISTER_STEPS.length - 1);
    setCompleted(nextCompleted);
    setErrors({});
    setStep(ns);
    persist(ns, nextCompleted);
    toTop();
  }

  function jump(target: number) {
    setErrors({});
    setStep(target);
    persist(target, completed);
    toTop();
  }

  async function submit() {
    for (let s = 0; s < REGISTER_STEPS.length; s++) {
      const e = check(s);
      if (Object.values(e).some(Boolean)) {
        hapticWarning();
        setErrors(e);
        setStep(s);
        toTop();
        return;
      }
    }
    setStatus("submitting");
    setSubmitError(null);
    const signed = { ...data, signDate: todayISO() };
    setData(signed);
    try {
      const id = await submitRegistration(signed);
      clearDraft(userId, dogKey);
      setSavedDogId(id);
      hapticSuccess();
      setStatus("success");
      toTop();
    } catch (err) {
      hapticError();
      setStatus("idle");
      setSubmitError(err instanceof Error ? err.message : "Couldn't submit. Please try again.");
      persist(step, completed, signed);
    }
  }

  function startOver() {
    Alert.alert("Start again?", "This clears the answers saved on this phone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Start again",
        style: "destructive",
        onPress: () => {
          clearDraft(userId, dogKey);
          setData({ ...emptyWaiver, dogId: data.dogId, dogName: data.dogName, email: data.email, signDate: todayISO() });
          setDobText("");
          setCompleted([]);
          setStep(0);
          setRestored(false);
          setErrors({});
        },
      },
    ]);
  }

  /** The vaccination record goes up as soon as it's chosen, so it survives the draft. */
  async function upload(file: PickedFile) {
    if (file.size && file.size > 10 * 1024 * 1024) {
      hapticWarning();
      setErrors((e) => ({ ...e, vaccFile: "That file is over 10 MB — please choose a smaller one." }));
      return;
    }
    setUploading(true);
    setErrors((e) => ({ ...e, vaccFile: "" }));
    try {
      const up = await uploadDocument(file, { kind: "vaccination", dogId: null, record: false });
      setData((d) => {
        const nd = { ...d, vaccFile: up.fileName, vaccPath: up.path, vaccType: up.contentType };
        if (userId) saveDraft(userId, dogKey, { step, completed, data: nd, dobText });
        return nd;
      });
      hapticSuccess();
    } catch (err) {
      hapticError();
      setErrors((e) => ({ ...e, vaccFile: err instanceof Error ? err.message : "Couldn't upload that. Please try again." }));
    } finally {
      setUploading(false);
    }
  }

  async function pickVacc(from: "camera" | "photos" | "files") {
    try {
      if (from === "files") {
        const r = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
        if (r.canceled || !r.assets[0]) return;
        const a = r.assets[0];
        await upload({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? "application/pdf", size: a.size });
        return;
      }
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
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.7 };
      const r = from === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (r.canceled || !r.assets[0]) return;
      const a = r.assets[0];
      await upload({ uri: a.uri, name: a.fileName ?? "vaccination-record.jpg", mimeType: a.mimeType ?? "image/jpeg", size: a.fileSize });
    } catch {
      hapticError();
      setErrors((e) => ({ ...e, vaccFile: "Couldn't open that. Please try again." }));
    }
  }

  const dogName = data.dogName.trim() || "your dog";
  const reachable = (i: number) => i < step || completed.includes(i) || completed.includes(i - 1);

  if (status === "success") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + 40, paddingHorizontal: 24 }}>
        <Appear style={{ alignItems: "center" }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: "rgba(34,197,94,0.15)", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="checkmark-circle" size={56} color={colors.success} />
          </View>
          <Text style={{ color: colors.foreground, fontSize: 26, fontWeight: "800", marginTop: 20, textAlign: "center" }}>{dogName} is registered</Text>
          <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 10, textAlign: "center" }}>
            Thank you, {data.firstName || "there"}. {dogName}&apos;s consent &amp; waiver is saved to your account, and we&apos;ve let the trainers know. We&apos;ll be in touch to confirm your training day.
          </Text>
        </Appear>
        <Appear index={1} style={{ marginTop: 28, gap: 12 }}>
          <PrimaryButton title="Back to my profile" onPress={() => (router.canGoBack() ? router.back() : router.replace("/dog"))} />
          {savedDogId && (
            <Pressable onPress={() => router.replace({ pathname: "/my-dogs/[id]", params: { id: savedDogId } })} style={{ alignItems: "center", paddingVertical: 12 }}>
              <Text style={{ color: colors.foreground, fontSize: 15, textDecorationLine: "underline" }}>View {dogName}&apos;s record</Text>
            </Pressable>
          )}
        </Appear>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.foreground} />
      </View>
    );
  }

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <ScrollView
      ref={scrollRef}
      scrollEnabled={!drawing}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 4, paddingBottom: insets.bottom + 48 }}
    >
      {/* Kanvas's WizardHeader: back, the eyebrow, the step, a bar per step. */}
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/dog"))} hitSlop={10} accessibilityLabel="Close" style={{ alignSelf: "flex-start", marginLeft: -6, marginBottom: 10, marginTop: 6 }}>
        <Ionicons name="chevron-back" size={26} color={colors.foreground} />
      </Pressable>
      <Text style={{ color: colors.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Register {data.dogName.trim() || "your dog"}</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 4 }}>
        <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "700", flex: 1 }}>{REGISTER_STEPS[step]}</Text>
        {saved && <Text style={{ color: colors.success, fontSize: 12, marginBottom: 4 }}>Saved</Text>}
      </View>
      <View style={{ flexDirection: "row", gap: 5, marginTop: 14 }}>
        {REGISTER_STEPS.map((label, i) => (
          <Pressable
            key={label}
            disabled={!reachable(i) || i === step}
            onPress={() => {
              hapticSelection();
              jump(i);
            }}
            hitSlop={{ top: 10, bottom: 10 }}
            accessibilityLabel={`Step ${i + 1}: ${label}`}
            style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i <= step ? colors.accent : completed.includes(i) ? "rgba(245,242,234,0.45)" : colors.border }}
          />
        ))}
      </View>
      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>
        Step {step + 1} of {REGISTER_STEPS.length}
      </Text>

      {restored && step < SIGN_STEP && (
        <View style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, ...GLASS_BORDER, borderRadius: 12, backgroundColor: colors.surface, padding: 12 }}>
          <Ionicons name="bookmark-outline" size={18} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 13, flex: 1 }}>We kept your answers from last time.</Text>
          <Pressable onPress={startOver} hitSlop={8}>
            <Text style={{ color: colors.foreground, fontSize: 13, textDecorationLine: "underline" }}>Start again</Text>
          </Pressable>
        </View>
      )}
      {alreadySigned && step === 0 && (
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 14 }}>
          {dogName} was registered on {new Date(alreadySigned).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. Signing again saves an updated form.
        </Text>
      )}

      <Appear key={step} style={{ marginTop: 20, gap: 18 }}>
        {step === 0 && (
          <>
            <Field label="First name" required value={data.firstName} onChangeText={set("firstName")} error={errors.firstName} autoCapitalize="words" textContentType="givenName" />
            <Field label="Last name" required value={data.lastName} onChangeText={set("lastName")} error={errors.lastName} autoCapitalize="words" textContentType="familyName" />
            <Field label="Email" required value={data.email} onChangeText={set("email")} error={errors.email} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" placeholder="you@example.com" />
            <PhoneRow label="Emergency Contact 1" required codes={dialCodes} code={data.em1Code} number={data.em1} onCode={set("em1Code")} onNumber={set("em1")} error={errors.em1} />
            <PhoneRow label="Emergency Contact 2" required codes={dialCodes} code={data.em2Code} number={data.em2} onCode={set("em2Code")} onNumber={set("em2")} error={errors.em2} />
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: -6 }}>Two emergency contact numbers we can use during our services, if required.</Text>
          </>
        )}
        {step === 1 && (
          <>
            <SelectField label="Country/Region" required options={countryOptions} value={data.country} onChange={set("country")} error={errors.country} placeholder="Country/Region" />
            <Field label="Address" required value={data.address} onChangeText={set("address")} error={errors.address} placeholder="Street address" textContentType="streetAddressLine1" autoCapitalize="words" />
            <Field label="City" required value={data.city} onChangeText={set("city")} error={errors.city} textContentType="addressCity" autoCapitalize="words" />
            <Field label="Zip / Postal code" required value={data.postcode} onChangeText={set("postcode")} error={errors.postcode} textContentType="postalCode" autoCapitalize="characters" />
            <Text style={{ color: colors.muted, fontSize: 13 }}>This is where we collect {dogName} from and drop them back.</Text>
          </>
        )}
        {step === 2 && (
          <>
            <Field label="Dog's full name" required value={data.dogName} onChangeText={set("dogName")} error={errors.dogName} autoCapitalize="words" />
            <Field label="Breed" required value={data.breed} onChangeText={set("breed")} error={errors.breed} autoCapitalize="words" />
            <DateField
              label="Date of birth"
              required
              text={dobText}
              onChange={(text, iso) => {
                setDobText(text);
                setData((d) => ({ ...d, dob: iso }));
                setErrors((e) => (e.dob ? { ...e, dob: "" } : e));
              }}
              error={errors.dob}
            />
            <Choice label="Gender" required options={genderOptions.filter((g) => g.value)} value={data.gender} onChange={set("gender")} error={errors.gender} />
            <Field label="Microchip Number" required value={data.microchip} onChangeText={set("microchip")} error={errors.microchip} keyboardType="number-pad" />
          </>
        )}
        {step === 3 && (
          <>
            <View>
              <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 8 }}>
                Upload Vaccination Record <Text style={{ color: colors.muted }}>*</Text>
              </Text>
              {data.vaccPath && !uploading ? (
                <View style={[CARD, { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderColor: "rgba(34,197,94,0.35)" }]}>
                  <Ionicons name="document-attach-outline" size={20} color={colors.success} />
                  <Text style={{ color: colors.foreground, fontSize: 14, flex: 1 }} numberOfLines={1}>
                    {data.vaccFile}
                  </Text>
                  <Text style={{ color: colors.success, fontSize: 13 }}>Uploaded</Text>
                </View>
              ) : null}
              {uploading ? (
                <View style={[CARD, { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 }]}>
                  <ActivityIndicator color={colors.foreground} />
                  <Text style={{ color: colors.muted, fontSize: 14 }}>Uploading…</Text>
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: 8, marginTop: data.vaccPath ? 10 : 0 }}>
                  <UploadButton icon="camera-outline" label="Camera" onPress={() => pickVacc("camera")} />
                  <UploadButton icon="images-outline" label="Photos" onPress={() => pickVacc("photos")} />
                  <UploadButton icon="document-outline" label="Files" onPress={() => pickVacc("files")} />
                </View>
              )}
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>A photo or PDF, up to 10 MB. Kept privately on your account.</Text>
              {errors.vaccFile ? <Text style={{ color: colors.danger, fontSize: 13, marginTop: 6 }}>{errors.vaccFile}</Text> : null}
            </View>
            <Checkbox checked={data.vaccConfirmed} onToggle={() => toggle("vaccConfirmed")} error={errors.vaccConfirmed}>
              I confirm vaccinations are up to date.
            </Checkbox>
            <Choice label="Does your dog receive Kennel Cough vaccinations?" required options={YES_NO} columns={2} value={data.kennelCough} onChange={set("kennelCough")} error={errors.kennelCough} />
          </>
        )}
        {step === 4 && (
          <>
            <Choice label="Medical Conditions" required options={YES_NO} columns={2} value={data.medical} onChange={set("medical")} error={errors.medical} />
            {data.medical === "yes" && <Field label="Please give details" required multiline value={data.medicalDetails} onChangeText={set("medicalDetails")} error={errors.medicalDetails} />}
            <Choice label="Allergies" required options={YES_NO} columns={2} value={data.allergies} onChange={set("allergies")} error={errors.allergies} />
            {data.allergies === "yes" && <Field label="Please give details" required multiline value={data.allergyDetails} onChangeText={set("allergyDetails")} error={errors.allergyDetails} />}
          </>
        )}
        {step === 5 && (
          <>
            <Field label="Vet's Name" required value={data.vetName} onChangeText={set("vetName")} error={errors.vetName} autoCapitalize="words" />
            <PhoneRow label="Vet's Contact Number" required codes={dialCodes} code={data.vetCode} number={data.vetPhone} onCode={set("vetCode")} onNumber={set("vetPhone")} error={errors.vetPhone} />
            <Field label="Vet's Address" required value={data.vetAddress} onChangeText={set("vetAddress")} error={errors.vetAddress} autoCapitalize="words" />
          </>
        )}
        {step === 6 && (
          <>
            <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}>{waiverTitle}</Text>
            <ScrollView nestedScrollEnabled style={{ maxHeight: 340, borderWidth: 1, ...GLASS_BORDER, borderRadius: 14, backgroundColor: colors.surface }} contentContainerStyle={{ padding: 16, gap: 16 }}>
              {waiverClauses.map((c) => (
                <View key={c.heading} style={{ gap: 6 }}>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700" }}>{c.heading}</Text>
                  {c.lead && <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>{c.lead}</Text>}
                  {c.bullets?.map((b, i) => (
                    <View key={i} style={{ flexDirection: "row", gap: 8, paddingLeft: 4 }}>
                      <Text style={{ color: colors.muted, fontSize: 13 }}>{"•"}</Text>
                      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, flex: 1 }}>{b}</Text>
                    </View>
                  ))}
                  {c.note && <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>{c.note}</Text>}
                  {c.body && <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>{c.body}</Text>}
                </View>
              ))}
            </ScrollView>
            <Checkbox checked={data.agreed} onToggle={() => toggle("agreed")} error={errors.agreed}>
              {waiverAgreement}
            </Checkbox>
          </>
        )}
        {step === REVIEW_STEP && <Review data={data} onEdit={jump} />}
        {step === SIGN_STEP && (
          <>
            <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 20 }}>To be signed by the dog&apos;s owner, who must be 18 or over.</Text>
            <Field label="The Client (Full Name)" required value={data.clientName} onChangeText={set("clientName")} error={errors.clientName} autoCapitalize="words" />
            <View>
              <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 6 }}>Date signed</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, backgroundColor: colors.surface }}>
                <Ionicons name="calendar-outline" size={16} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 15 }}>
                  {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" })}
                </Text>
              </View>
            </View>
            <View>
              <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 6 }}>
                Client signature <Text style={{ color: colors.muted }}>*</Text>
              </Text>
              <SignaturePad
                value={data.signature}
                invalid={!!errors.signature}
                onDrawingChange={setDrawing}
                onChange={(url) => {
                  setData((d) => ({ ...d, signature: url }));
                  if (url) setErrors((e) => ({ ...e, signature: "" }));
                }}
              />
              {errors.signature ? <Text style={{ color: colors.danger, fontSize: 13, marginTop: 6 }}>{errors.signature}</Text> : null}
            </View>
          </>
        )}
      </Appear>

      {submitError && (
        <View style={{ marginTop: 20, borderWidth: 1, borderColor: "rgba(225,29,51,0.35)", backgroundColor: "rgba(225,29,51,0.08)", borderRadius: 12, padding: 14 }}>
          <Text style={{ color: colors.danger, fontSize: 14 }}>Couldn&apos;t submit: {submitError}</Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>Your answers are still saved on this phone.</Text>
        </View>
      )}
      {errorCount > 0 && (
        <Text style={{ color: colors.danger, fontSize: 14, marginTop: 18 }}>Please check the highlighted {errorCount === 1 ? "field" : "fields"} above.</Text>
      )}

      <View style={{ flexDirection: "row", gap: 12, marginTop: 24, alignItems: "center" }}>
        {step > 0 && (
          <Pressable onPress={() => jump(step - 1)} disabled={status === "submitting"} style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
            <Text style={{ color: colors.muted, fontSize: 15 }}>Back</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <PrimaryButton
            title={step === SIGN_STEP ? "Sign & submit" : step === REVIEW_STEP ? "Everything's right" : "Next"}
            onPress={step === SIGN_STEP ? submit : next}
            loading={status === "submitting"}
          />
        </View>
      </View>
      {step < SIGN_STEP && <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 14 }}>Your answers are saved on this phone as you go.</Text>}
    </ScrollView>
  );
}

function UploadButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Upload from ${label}`}
      style={{ flex: 1, alignItems: "center", gap: 6, paddingVertical: 14, borderRadius: 14, borderWidth: 1, ...GLASS_BORDER, backgroundColor: colors.surface }}
    >
      <Ionicons name={icon} size={22} color={colors.foreground} />
      <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

/** Every answer before signing, a section per step, each with Edit. */
function Review({ data, onEdit }: { data: WaiverData; onEdit: (step: number) => void }) {
  const yes = (v: string) => (v === "yes" ? "Yes" : v === "no" ? "No" : "—");
  const sections: { step: number; title: string; rows: [string, string][] }[] = [
    {
      step: 0,
      title: "About you",
      rows: [
        ["Name", `${data.firstName} ${data.lastName}`.trim()],
        ["Email", data.email],
        ["Emergency contact 1", data.em1 ? `${data.em1Code} ${data.em1}` : ""],
        ["Emergency contact 2", data.em2 ? `${data.em2Code} ${data.em2}` : ""],
      ],
    },
    { step: 1, title: "Your address", rows: [["Address", [data.address, data.city, data.postcode, data.country].filter((x) => x.trim()).join(", ")]] },
    {
      step: 2,
      title: "Dog's details",
      rows: [
        ["Name", data.dogName],
        ["Breed", data.breed],
        ["Date of birth", isoToUk(data.dob)],
        ["Gender", data.gender],
        ["Microchip", data.microchip],
      ],
    },
    {
      step: 3,
      title: "Vaccinations",
      rows: [
        ["Vaccination record", data.vaccFile],
        ["Up to date", data.vaccConfirmed ? "Yes" : "No"],
        ["Kennel cough", yes(data.kennelCough)],
      ],
    },
    {
      step: 4,
      title: "Health",
      rows: [
        ["Medical conditions", data.medical === "yes" ? data.medicalDetails : yes(data.medical) === "No" ? "None" : "—"],
        ["Allergies", data.allergies === "yes" ? data.allergyDetails : yes(data.allergies) === "No" ? "None" : "—"],
      ],
    },
    { step: 5, title: "Vet", rows: [["Vet", [data.vetName, data.vetPhone ? `${data.vetCode} ${data.vetPhone}` : "", data.vetAddress].filter(Boolean).join(" · ")]] },
    { step: 6, title: "Consent & waiver", rows: [["Agreed", data.agreed ? "Yes" : "No"]] },
  ];
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>Check everything is right before you sign. Tap Edit to change anything.</Text>
      {sections.map((s) => (
        <View key={s.title} style={[CARD, { gap: 8 }]}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700", flex: 1 }}>{s.title}</Text>
            <Pressable onPress={() => onEdit(s.step)} hitSlop={10} accessibilityLabel={`Edit ${s.title}`}>
              <Text style={{ color: colors.foreground, fontSize: 13, textDecorationLine: "underline" }}>Edit</Text>
            </Pressable>
          </View>
          {s.rows.map(([k, v]) => (
            <View key={k} style={{ flexDirection: "row", gap: 12 }}>
              <Text style={{ color: colors.muted, fontSize: 13, width: 130 }}>{k}</Text>
              <Text style={{ color: colors.foreground, fontSize: 13, flex: 1 }}>{v || "—"}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
