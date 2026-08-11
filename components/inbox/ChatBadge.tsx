import type { UnreadCounts } from "@/lib/inbox/types";

/**
 * Combined unread count. In the live build this becomes a client component
 * subscribed to three Realtime channels (messages, notifications, requests),
 * each bumping one local counter. Here it just sums the provided counts.
 */
export function ChatBadge({ counts }: { counts: UnreadCounts }) {
  const total = counts.chat + counts.notifications + counts.requests;
  if (total <= 0) return null;
  return (
    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-accent-ink">
      {total}
    </span>
  );
}
