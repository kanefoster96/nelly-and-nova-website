import { CommunityFeed } from "@/components/community/CommunityFeed";
import { BroadcastComposer } from "@/components/admin/BroadcastComposer";
import { useSession } from "@/lib/session";

/**
 * Home — the same community feed as the customer app (coaches can always
 * post, per the `posts` RLS's `is_admin()` clause), with a notification/
 * email blast composer pinned above it.
 */
export default function AdminHomeScreen() {
  const session = useSession();
  return (
    <CommunityFeed
      canPost
      ownerName={session?.ownerName}
      avatarUrl={session?.avatarUrl}
      headerExtra={<BroadcastComposer />}
    />
  );
}
