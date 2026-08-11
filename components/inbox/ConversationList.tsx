"use client";

import { useMemo, useState } from "react";
import { formatTime } from "@/lib/inbox/format";
import type { Conversation } from "@/lib/inbox/types";

const BUCKET_ORDER: Record<Conversation["status"], number> = {
  new: 0,
  active: 1,
  closed: 2,
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Scaffold: client-side match on name + preview. In the live build, also
    // union with an ilike over messages.body for full-history search.
    const list = q
      ? conversations.filter(
          (c) =>
            c.user.name.toLowerCase().includes(q) ||
            c.lastMessagePreview.toLowerCase().includes(q)
        )
      : conversations;
    return [...list].sort(
      (a, b) =>
        BUCKET_ORDER[a.status] - BUCKET_ORDER[b.status] ||
        b.lastMessageAt.localeCompare(a.lastMessageAt)
    );
  }, [conversations, query]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-3xl bg-white/[0.03] ring-1 ring-white/10">
      <div className="p-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations…"
          aria-label="Search conversations"
          className="w-full rounded-full border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm text-paper placeholder:text-paper-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {filtered.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-paper-dim">
            No conversations.
          </li>
        )}
        {filtered.map((c) => {
          const active = c.id === selectedId;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${
                  active ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-paper">
                  {initials(c.user.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-paper">
                      {c.user.name}
                      {c.user.isGuest && (
                        <span className="ml-2 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-paper-dim">
                          Visitor
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-[11px] text-paper-dim">
                      {formatTime(c.lastMessageAt)}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="truncate text-sm text-paper/60">
                      {c.lastMessagePreview}
                    </span>
                    {c.unread && (
                      <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-accent" />
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
