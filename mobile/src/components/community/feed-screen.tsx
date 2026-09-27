import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { PostCard } from "@/components/community/post-card";
import { PostComposer } from "@/components/community/post-composer";
import { LoadingState } from "@/components/ui";
import { getFeed } from "@/data/community";
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  if (!posts) return <LoadingState error={error?.message} />;

  return (
    <FlatList
      automaticallyAdjustKeyboardInsets
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 48 }}
      data={posts}
      keyExtractor={(post) => post.id}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.foreground} />}
      ListHeaderComponent={
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <PostComposer viewer={viewer} onPosted={(post) => setData((prev) => [post, ...(prev ?? [])])} />
        </View>
      }
      ListEmptyComponent={
        <View style={{ padding: 32 }}>
          <Text style={{ color: colors.muted, textAlign: "center" }}>No posts yet — be the first to share something.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <PostCard
          viewer={viewer}
          post={item}
          onDeleted={(id) => setData((prev) => prev?.filter((p) => p.id !== id))}
          onAuthorBlocked={(authorId) => setData((prev) => prev?.filter((p) => p.authorId !== authorId))}
        />
      )}
    />
  );
}
