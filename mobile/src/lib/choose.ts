import { Alert, Platform } from "react-native";

export type Choice = { text: string; onPress: () => void; style?: "default" | "destructive" };

/**
 * "Pick one of these" as a system alert, with a Cancel (the Kanvas app's
 * lib/choose.ts). iOS lists every choice. Android's alert has room for
 * three buttons and silently drops the rest (Cancel included, which leaves
 * a dialog you can't back out of), so there it shows two choices at a time
 * with "More…" leading to the next.
 */
export function chooseOne(title: string, message: string | undefined, choices: Choice[]) {
  if (Platform.OS !== "android") {
    Alert.alert(title, message, [...choices, { text: "Cancel", style: "cancel" }]);
    return;
  }
  const page = choices.slice(0, 2);
  const rest = choices.slice(2);
  Alert.alert(
    title,
    message,
    rest.length > 0 ? [...page, { text: "More…", onPress: () => chooseOne(title, message, rest) }] : [...page, { text: "Cancel", style: "cancel" }],
    { cancelable: true },
  );
}
