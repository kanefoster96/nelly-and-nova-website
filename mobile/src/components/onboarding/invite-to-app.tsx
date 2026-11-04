import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Share, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";

import { GlassButton } from "@/components/glass-button";
import { BigButton, DetailCard } from "@/components/trainer/cards";
import { config } from "@/lib/config";
import { hapticSuccess } from "@/lib/haptics";
import { colors } from "@/theme";

/** The website's "Get the app" page (app/app/page.tsx there): the App Store, or TestFlight until then. */
export const APP_INVITE_URL = `${config.siteUrl.replace(/\/$/, "")}/app`;

/** The QR code's SVG, drawn by the website (/api/qr, our own links only). Kept once fetched. */
const qrCache = new Map<string, string>();
async function qrSvg(data: string): Promise<string> {
  const hit = qrCache.get(data);
  if (hit) return hit;
  const res = await fetch(`${config.siteUrl.replace(/\/$/, "")}/api/qr?data=${encodeURIComponent(data)}`);
  const text = await res.text();
  if (!res.ok || !text.includes("<svg")) throw new Error("No QR code");
  qrCache.set(data, text);
  return text;
}

function QrCode({ data, size }: { data: string; size: number }) {
  const [xml, setXml] = useState<string | null>(qrCache.get(data) ?? null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    qrSvg(data)
      .then((x) => live && setXml(x))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [data]);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff", borderRadius: 20, overflow: "hidden" }}>
      {xml ? (
        <SvgXml xml={xml} width={size} height={size} accessibilityLabel="QR code for the Nelly & Nova app" />
      ) : failed ? (
        <Text style={{ color: "#0a0a0a", fontSize: 14, textAlign: "center", paddingHorizontal: 24 }}>Couldn&apos;t load the QR code. Share the link instead.</Text>
      ) : (
        <ActivityIndicator color="#0a0a0a" />
      )}
    </View>
  );
}

/**
 * Trainer, at the meet & greet: "Invite to the app" on a request's page
 * (app/(app)/onboarding/[id].tsx). A big QR code for the owner to scan
 * with their iPhone's camera, opening the website's /app page (App Store,
 * or TestFlight for now), and a share sheet with a friendly message and the
 * link, for a text or WhatsApp. Either way they log in with the email they
 * gave us.
 */
export function InviteToApp({ name, email, dogNames, index = 0 }: { name: string; email: string | null; dogNames: string | null; index?: number }) {
  const [open, setOpen] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const first = name.trim().split(/\s+/)[0] ?? "";
  const dogs = dogNames ? dogNames.replace(/, ([^,]*)$/, " & $1") : "";
  const size = Math.min(width - 64, 340);

  async function share() {
    const message = [
      `Hi${first ? ` ${first}` : ""}! Here's the Nelly & Nova app, for ${dogs ? `${dogs}'s` : "your"} sessions, pick-up updates, report cards and homework, and a chat with us:`,
      APP_INVITE_URL,
      email ? `Log in with ${email}, the email you gave us.` : "Log in with the email you gave us.",
    ].join("\n\n");
    try {
      const r = await Share.share({ message });
      if (r.action === Share.sharedAction) hapticSuccess();
    } catch {
      // The share sheet was closed.
    }
  }

  return (
    <>
      <DetailCard index={index} title="Invite to the app" icon="phone-portrait-outline">
        <Text style={{ color: colors.foreground, fontSize: 15, lineHeight: 21 }}>
          Show {first || "them"} the QR code to scan with their iPhone&apos;s camera, or send them the link.
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>
          {email ? `They log in with ${email}.` : "They log in with the email they gave us."}
        </Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          <BigButton icon="qr-code-outline" label="Show QR code" onPress={() => setOpen(true)} style={{ flex: 1 }} />
          <BigButton icon="share-outline" label="Send link" variant="outline" onPress={share} style={{ flex: 1 }} />
        </View>
      </DetailCard>

      <Modal visible={open} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16, paddingHorizontal: 24 }}>
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <GlassButton onPress={() => setOpen(false)} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.foreground} />
            </GlassButton>
          </View>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 22 }}>
            <View style={{ alignItems: "center", gap: 6 }}>
              <Text style={{ color: colors.foreground, fontSize: 26, fontWeight: "800", textAlign: "center" }}>Get the app</Text>
              <Text style={{ color: colors.muted, fontSize: 15, textAlign: "center", lineHeight: 21 }}>Point your iPhone&apos;s camera at the code{"\n"}and tap the link that appears.</Text>
            </View>
            <QrCode data={APP_INVITE_URL} size={size} />
            <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center" }} selectable>
              {APP_INVITE_URL.replace(/^https?:\/\//, "")}
            </Text>
            {!!email && <Text style={{ color: colors.foreground, fontSize: 15, textAlign: "center" }}>Then log in with {email}</Text>}
          </View>
          <BigButton icon="share-outline" label="Send the link instead" variant="outline" onPress={share} />
        </View>
      </Modal>
    </>
  );
}
