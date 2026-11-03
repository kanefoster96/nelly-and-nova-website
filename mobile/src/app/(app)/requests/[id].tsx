import { useLocalSearchParams } from "expo-router";

import { RequestsScreen } from "@/components/sessions/requests-screen";

/** One request, from a notification or a chat line's /requests/<id>. */
export default function RequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const valid = typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id) ? id : undefined;
  return <RequestsScreen id={valid ?? "00000000-0000-0000-0000-000000000000"} />;
}
