import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Platform, Text } from "react-native";

import { colors } from "@/theme";

const version = Constants.expoConfig?.version ?? "?";
const build = Platform.OS === "ios" ? Constants.platform?.ios?.buildNumber : Constants.platform?.android?.versionCode?.toString();

/**
 * "v1.0.0 (14) · production · update 3d55a95" — which binary and which OTA
 * update is actually on this device. Quiet on purpose: it only matters when
 * someone asks "did my change ship?".
 */
export function BuildInfo() {
  const update = !Updates.isEnabled || !Updates.updateId ? null : Updates.isEmbeddedLaunch ? "built-in" : `update ${Updates.updateId.slice(0, 7)}`;
  const parts = [`v${version}${build ? ` (${build})` : ""}`, Updates.channel || "dev", update].filter(Boolean);
  return (
    <Text selectable style={{ color: colors.muted, fontSize: 11, textAlign: "center", opacity: 0.7, paddingVertical: 16 }}>
      {parts.join(" · ")}
    </Text>
  );
}
