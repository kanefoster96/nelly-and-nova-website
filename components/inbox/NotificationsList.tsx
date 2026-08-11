"use client";

import { useState } from "react";
import { formatTime } from "@/lib/inbox/format";
import type { Notification } from "@/lib/inbox/types";

export function NotificationsList({ initial }: { initial: Notification[] }) {
  const [items, setItems] = useState(initial);
  const unread = items.filter((n) => !n.readAt).length;

  function markAllRead() {
    // TODO(backend): persist read time (auth.users.user_metadata.notifications_read_at).
    const now = new Date().toISOString();
    setItems((list) => list.map((n) => (n.readAt ? n : { ...n, readAt: now })));
  }

  if (items.length === 0) {
    return <p className="text-sm text-paper-dim">No notifications yet.</p>;
  }

  return (
    <div>
      {unread > 0 && (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={markAllRead}
            className="text-xs font-medium text-paper/70 underline underline-offset-2 hover:text-accent"
          >
            Mark all as read
          </button>
        </div>
      )}
      <ul className="space-y-2">
        {items.map((n) => (
          <li
            key={n.id}
            className={`rounded-2xl p-4 ring-1 ${
              n.readAt
                ? "bg-white/[0.02] ring-white/5"
                : "bg-white/[0.05] ring-white/10"
            }`}
          >
            <div className="flex items-start gap-3">
              {!n.readAt && (
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold text-paper">{n.title}</p>
                  <span className="shrink-0 text-xs text-paper-dim">
                    {formatTime(n.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-paper/70">{n.body}</p>
                {n.actionHref && (
                  <a
                    href={n.actionHref}
                    className="mt-2 inline-block text-sm font-medium text-accent underline underline-offset-2"
                  >
                    View
                  </a>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
