import { Alert } from "react-native";

import { PrimaryButton } from "@/components/ui";
import { supabase } from "@/lib/supabase";

/**
 * Asks which one you mean: Supabase's default signOut() is global and would
 * also sign you out of the website and every other device.
 */
export function SignOutButton() {
  function confirmSignOut() {
    Alert.alert("Sign out", "Just this device, or everywhere you're signed in?", [
      { text: "Cancel", style: "cancel" },
      { text: "All devices", style: "destructive", onPress: () => void supabase.auth.signOut({ scope: "global" }) },
      { text: "This device", onPress: () => void supabase.auth.signOut({ scope: "local" }) },
    ]);
  }
  return <PrimaryButton title="Sign Out" onPress={confirmSignOut} />;
}
