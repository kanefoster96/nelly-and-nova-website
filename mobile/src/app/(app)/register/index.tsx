import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { getMyDogDetails } from "@/data/dog-profile";
import { useAsync } from "@/lib/useAsync";
import { colors } from "@/theme";

/**
 * "/register" (the register reminder notification): straight into the
 * form for the first dog still to register, a new dog if there are none
 * yet, or the Profile tab if every dog is done.
 */
export default function RegisterNextDog() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data: dogs, error } = useAsync(async () => (userId ? getMyDogDetails(userId) : null), [userId]);

  if (error) return <Redirect href="/dog" />;
  if (!dogs) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.foreground} />
      </View>
    );
  }
  const next = dogs.find((d) => !d.registered);
  if (next) return <Redirect href={{ pathname: "/register/[dogId]", params: { dogId: next.id } } as never} />;
  if (dogs.length === 0) return <Redirect href={{ pathname: "/register/[dogId]", params: { dogId: "new" } } as never} />;
  return <Redirect href="/dog" />;
}
