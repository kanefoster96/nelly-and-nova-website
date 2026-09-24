import type { PropsWithChildren } from "react";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";

import { colors, space } from "@/theme";

type Props = PropsWithChildren<{ refreshing?: boolean; onRefresh?: () => void }>;

/** Scrollable tab screen that sits under the native large title and tab bar. */
export function Screen({ children, refreshing = false, onRefresh }: Props) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.paperDim} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.ink },
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl },
});
