import { LayoutAnimation, Platform } from "react-native";

/**
 * Call just before the state change that adds or removes a row, so the
 * rows around it slide into place and the row itself fades, instead of
 * everything jumping. Only the very next layout is animated. (From the
 * Kanvas app.)
 */
export function animateListChange(): void {
  if (Platform.OS === "web") return;
  LayoutAnimation.configureNext({
    duration: 220,
    create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  });
}
