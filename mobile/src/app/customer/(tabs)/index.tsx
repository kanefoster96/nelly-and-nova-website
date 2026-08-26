import { CommunityFeed } from "@/components/community/CommunityFeed";
import { hasActiveMembership, useSession } from "@/lib/session";

/**
 * Home — the community feed (like a Facebook wall): every member's posts,
 * newest first. Viewing is open to anyone who reaches the customer app;
 * starting a post or commenting requires an active membership, enforced by
 * both the composer below and the "community_feed_access" RLS policies (see
 * lib/community.ts) — not just hidden in the UI. See CommunityFeed for the
 * shared rendering (also used by the coach app's Home tab).
 */
export default function HomeScreen() {
  const session = useSession();
  return (
    <CommunityFeed
      canPost={hasActiveMembership(session)}
      ownerName={session?.ownerName}
      avatarUrl={session?.avatarUrl}
    />
  );
}
