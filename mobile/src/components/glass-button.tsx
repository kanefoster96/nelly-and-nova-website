import type { ReactNode } from "react";
import type { ViewStyle } from "react-native";

import { GlassEdge } from "@/components/glass-edge";
import { Pressable, type PressableProps } from "@/components/pressable";
import { GLASS_FILL } from "@/theme";

/**
 * A round floating button in the same glass as the bar along the bottom
 * (components/floating-bar.tsx): its near-solid dark fill and its light-
 * catching edge (components/glass-edge.tsx), with a soft shadow. Used for
 * every button at the top of a page: your photo and the bell on a tab,
 * back on a pushed page, call and mark complete in a conversation.
 * (From the Kanvas app.)
 */
const SIZE = 44;

export const GLASS_BUTTON_STYLE: ViewStyle = {
  width: SIZE,
  height: SIZE,
  borderRadius: SIZE / 2,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: GLASS_FILL,
  boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
};

export function GlassButton({ children, style, ...rest }: Omit<PressableProps, "children" | "style"> & { children: ReactNode; style?: ViewStyle }) {
  return (
    <Pressable {...rest} style={[GLASS_BUTTON_STYLE, style, rest.disabled ? { opacity: 0.5 } : null]}>
      {children}
      <GlassEdge radius={SIZE / 2} />
    </Pressable>
  );
}
