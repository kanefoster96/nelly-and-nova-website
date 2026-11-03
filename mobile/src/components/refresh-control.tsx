import { RefreshControl as NativeRefreshControl, type RefreshControlProps } from "react-native";

import { hapticRefresh } from "@/lib/haptics";

/**
 * React Native's RefreshControl, plus the tap in the hand when a pull
 * starts a refresh (lib/haptics.ts). A drop-in: every prop goes straight
 * through. (From the Kanvas app.)
 */
export function RefreshControl({ onRefresh, ...props }: RefreshControlProps) {
  return (
    <NativeRefreshControl
      {...props}
      onRefresh={
        onRefresh
          ? () => {
              hapticRefresh();
              onRefresh();
            }
          : undefined
      }
    />
  );
}
