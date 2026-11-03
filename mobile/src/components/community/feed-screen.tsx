import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { FlatList, Text, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { Appear } from "@/components/appear";
import { PostCard } from "@/components/community/post-card";
import { PostComposer } from "@/components/community/post-composer";
import { PageTitle } from "@/components/page-title";
import { RefreshControl } from "@/components/refresh-control";
import { LoadingState } from "@/components/ui";
import { getFeed, getViewer, type Post, type Viewer } from "@/data/community";
import { useBarInset, useBarScroll, useTopBarInset } from "@/lib/floating-bar";
import { animateListChange } from "@/lib/layout-animation";
import { colors } from "@/theme";

export type { Viewer } from "@/data/community";

type Feed = { viewer: Viewer; posts: Post[] };

/**
 * The community feed — the Kanvas Student Home tab, same for members and
 * trainers (trainers can also pin and delete anything). Live from Supabase;
 * refreshed each time the tab comes into view and on pull-to-refresh.
 */
export function CommunityFeedScreen() {
  const { session, isTrainer } = useAuth();
  const userId = session?.user.id ?? "";
  const [data, setData] = useState<Feed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const ticket = useRef(0);
  // Under the floating top buttons and over the floating bar (lib/floating-bar.tsx).
  const barScroll = useBarScroll();
  const barInset = useBarInset();
  const topInset = useTopBarInset();

  const load = useCallback(async () => {
    if (!userId) return;
    const mine = ++ticket.current;
    try {
      const viewer = await getViewer(userId, isTrainer);
      const posts = await getFeed(viewer);
      if (mine === ticket.current) {
        setData({ viewer, posts });
        setError(null);
      }
    } catch (err) {
      if (mine === ticket.current) setError(err instanceof Error ? err.message : "Couldn't load the community.");
    }
  }, [userId, isTrainer]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Once the guidelines are agreed (with a first post or comment) every other
  // composer on screen drops its checkbox too.
  const markGuidelinesAccepted = useCallback(() => {
    setData((prev) => (prev ? { ...prev, viewer: { ...prev.viewer, guidelinesAccepted: true } } : prev));
  }, []);

  const removePosts = useCallback((keep: (p: Post) => boolean) => {
    animateListChange();
    setData((prev) => (prev ? { ...prev, posts: prev.posts.filter(keep) } : prev));
  }, []);

  if (!data) return <LoadingState error={error} />;
  const { viewer, posts } = data;

  return (
    // automaticallyAdjustKeyboardInsets scrolls a comment box deep in the
    // feed up above the keyboard.
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
          <PostComposer viewer={viewer} onPosted={load} onGuidelinesAccepted={markGuidelinesAccepted} />
          {error && <Text style={{ color: colors.danger, fontSize: 12, marginTop: 10 }}>{error}</Text>}
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
            onGuidelinesAccepted={markGuidelinesAccepted}
            onDeleted={(id) => removePosts((p) => p.id !== id)}
            onPinnedChange={() => load()}
            onAuthorBlocked={(authorId) => removePosts((p) => p.authorId !== authorId)}
          />
        </Appear>
      )}
    />
  );
}
