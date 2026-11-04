import { Alert, Linking, Platform } from "react-native";

import { hapticError } from "@/lib/haptics";

/*
 * Reaching an owner from the trainer's pages: a call, WhatsApp, an email,
 * and directions to their address. All open other apps, never a page of
 * our own site.
 */

function open(url: string, what: string) {
  Linking.openURL(url).catch(() => {
    hapticError();
    Alert.alert(`Couldn't open ${what}`, "Please try again.");
  });
}

export function callNumber(phone: string) {
  open(`tel:${phone.replace(/[^\d+]/g, "")}`, "the phone");
}

/** WhatsApp wants the number in international form, no "+": UK 07… becomes 447…. */
export function whatsappNumber(phone: string): string {
  let digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `44${digits.slice(1)}`;
  return digits;
}

export function openWhatsApp(phone: string) {
  open(`https://wa.me/${whatsappNumber(phone)}`, "WhatsApp");
}

export function sendEmail(email: string) {
  open(`mailto:${email}`, "your email");
}

/**
 * Directions to an address. On iPhone: Apple Maps, or a choice with Google
 * Maps when the phone lets us see it's installed (canOpenURL only answers
 * for apps the build lists in LSApplicationQueriesSchemes, so this falls
 * back to Apple Maps alone until a build adds comgooglemaps). On Android:
 * Google Maps.
 */
export async function openDirections(address: string) {
  const q = encodeURIComponent(address.trim());
  if (!q) return;
  if (Platform.OS !== "ios") {
    open(`https://www.google.com/maps/dir/?api=1&destination=${q}`, "Maps");
    return;
  }
  const apple = `https://maps.apple.com/?daddr=${q}`;
  const google = `comgooglemaps://?daddr=${q}&directionsmode=driving`;
  const hasGoogle = await Linking.canOpenURL("comgooglemaps://").catch(() => false);
  if (!hasGoogle) {
    open(apple, "Maps");
    return;
  }
  Alert.alert("Directions", address, [
    { text: "Apple Maps", onPress: () => open(apple, "Maps") },
    { text: "Google Maps", onPress: () => open(google, "Google Maps") },
    { text: "Cancel", style: "cancel" },
  ]);
}

/** One line for an owner's address: their pick-up address, else their home address. */
export function addressLine(p: { pickup_address?: string | null; address?: string | null; city?: string | null; postcode?: string | null } | null | undefined): string | null {
  if (!p) return null;
  const pickup = p.pickup_address?.trim();
  if (pickup) return pickup;
  const line = [p.address, p.city, p.postcode].map((x) => x?.trim()).filter(Boolean).join(", ");
  return line || null;
}

/** "Sarah" from "Sarah Jones". */
export function firstName(full: string | null | undefined): string {
  return (full ?? "").trim().split(/\s+/)[0] ?? "";
}
