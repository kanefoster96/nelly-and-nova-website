import { useCallback, useMemo, useState } from "react";
import { FlatList, Text, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { Appear } from "@/components/appear";
import { PostCard } from "@/components/community/post-card";
import { PostComposer } from "@/components/community/post-composer";
import { PageTitle } from "@/components/page-title";
import { RefreshControl } from "@/components/refresh-control";
import { LoadingState } from "@/components/ui";
import { getFeed } from "@/data/community";
import { useBarInset, useBarScroll, useTopBarInset } from "@/lib/floating-bar";
import { animateListChange } from "@/lib/layout-animation";
import { useAsync } from "@/lib/useAsync";
import { colors } from "@/theme";

export type Viewer = { id: string; name: string; avatarUrl?: string | null; isTrainer: boolean };

/** The community feed — same for members and trainers (trainers can pin and delete). */
export function CommunityFeedScreen() {
  const { session, profile, isTrainer } = useAuth();
  const viewer = useMemo<Viewer>(
    () => ({
      id: session?.user.id ?? "",
      name: isTrainer ? "Nelly & Nova" : profile?.ownerName || session?.user.email || "Member",
      avatarUrl: profile?.avatarUrl,
      isTrainer,
    }),
    [session, profile, isTrainer]
  );
  const { data: posts, error, reload, setData } = useAsync(() => getFeed(viewer), [viewer]);
  const [refreshing, setRefreshing] = useState(false);
  // Under the floating top buttons and over the floating bar (lib/floating-bar.tsx).
  const barScroll = useBarScroll();
  const barInset = useBarInset();
  const topInset = useTopBarInset();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  if (!posts) return <LoadingState error={error?.message} />;

  return (
    <FlatList
      {...barScroll}
      automaticallyAdjustKeyboardInsets
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: barInset }}
      data={posts}
      keyExtractor={(post) => post.id}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.foreground} />}
      ListHeaderComponent={
        <View style={{ paddingHorizontal: 16, paddingTop: topInset + 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <PageTitle title="Community" style={{ marginHorizontal: 4, marginBottom: 12 }} />
          <PostComposer viewer={viewer} onPosted={(post) => setData((prev) => [post, ...(prev ?? [])])} />
        </View>
      }
      ListEmptyComponent={
        <View style={{ padding: 32 }}>
          <Text style={{ color: colors.muted, textAlign: "center" }}>No posts yet — be the first to share something.</Text>
        </View>
      }
      renderItem={({ item, index }) => (
        <Appear index={index}>
          <PostCard
            viewer={viewer}
            post={item}
            onDeleted={(id) => {
              animateListChange();
              setData((prev) => prev?.filter((p) => p.id !== id));
            }}
            onAuthorBlocked={(authorId) => {
              animateListChange();
              setData((prev) => prev?.filter((p) => p.authorId !== authorId));
            }}
          />
        </Appear>
      )}
    />
  );
}
