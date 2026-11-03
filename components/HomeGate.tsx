"use client";

import { useSession } from "@/lib/auth/session";
import { CommunityHome } from "./community/CommunityHome";

/**
 * The homepage is the marketing site by default (server-rendered — `children`).
 * A logged-in member who has a scheduled slot gets the community home instead:
 * their dog + quick actions above the feed. The swap happens on the client once
 * the session resolves.
 */
export function HomeGate({
  scheduledDogIds,
  children,
}: {
  scheduledDogIds: string[];
  children: React.ReactNode;
}) {
  const session = useSession();
  const isScheduledMember =
    session?.role === "member" &&
    !!session.dogId &&
    scheduledDogIds.includes(session.dogId);

  if (!isScheduledMember) return <>{children}</>;
  return <CommunityHome />;
}
