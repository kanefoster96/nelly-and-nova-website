import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { Appear } from "@/components/appear";
import { Field } from "@/components/form/fields";
import { ScreenHeader } from "@/components/screen-header";
import { FormScrollView, PrimaryButton } from "@/components/ui";
import { createDog } from "@/data/my-records";
import { hapticError, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { colors } from "@/theme";

/** Add a dog to the account (the website's AddDogForm), then open its record to fill in. */
export default function AddMyDogScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim()) {
      hapticWarning();
      return setError("What's your dog called?");
    }
    setError(undefined);
    setBusy(true);
    try {
      const dog = await createDog({ name: name.trim(), breed });
      hapticSuccess();
      router.replace({ pathname: "/my-dogs/[id]", params: { id: dog.id } } as never);
    } catch (e) {
      hapticError();
      setError(e instanceof Error ? e.message : "Couldn't add the dog.");
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Add a Dog" />
      <FormScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48 }}>
        <Appear style={{ gap: 18 }}>
          <Field label="Dog's name" required value={name} onChangeText={setName} error={error} autoCapitalize="words" autoFocus />
          <Field label="Breed" value={breed} onChangeText={setBreed} autoCapitalize="words" />
          <PrimaryButton title="Add dog" onPress={add} loading={busy} />
          <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>You can add their photo, health details and documents next.</Text>
        </Appear>
      </FormScrollView>
    </View>
  );
}
