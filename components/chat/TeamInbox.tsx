"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/community/Avatar";
import { ChatThread } from "./ChatThread";
import { chatSupabase, getInbox, setConversationCompleted } from "@/lib/chat/client";
import type { InboxConversation } from "@/lib/chat/types";

type Filter = "all" | "unread" | "open" | "completed";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "open", label: "Open" },
  { key: "completed", label: "Completed" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatActivity(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const days = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) /
      86_400_000
  );
  if (days === 0) return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return WEEKDAYS[date.getDay()];
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/**
 * The trainer side of the chat, ported from the Kanvas Academy coach inbox:
 * every owner's conversation (newest first, live), search and filters, and
 * the conversation itself with Mark complete / Reopen. On a phone the list
 * and the conversation take turns; on a wide screen they sit side by side.
 */
export function TeamInbox({
  viewerId,
  viewerName,
  initialName,
}: {
  viewerId: string;
  viewerName: string;
  /** Open this owner's conversation first (/inbox?name=…). */
  initialName?: string | null;
}) {
  const [conversations, setConversations] = useState<InboxConversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState(initialName ?? "");
  const [filter, setFilter] = useState<Filter>("all");
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await getInbox();
      setConversations(list);
      setError(null);
    } catch {
      setError("Couldn't load the inbox — please refresh.");
      setConversations((c) => c ?? []);
    }
  }, []);

  useEffect(() => {
    // Fetches from Supabase; state is only set once the request comes back.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // Any new message or status change anywhere refreshes the list.
    const supabase = chatSupabase();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(), 400);
    };
    const channel = supabase
      .channel("team-inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations" }, refresh)
      .subscribe();
    const poll = setInterval(() => void load(), 30_000);
    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [load]);

  const visible = useMemo(() => {
    if (!conversations) return null;
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === "unread" && !c.unread) return false;
      if (filter === "open" && (c.unread || c.completed)) return false;
      if (filter === "completed" && !c.completed) return false;
      if (!q) return true;
      return (
        c.ownerName.toLowerCase().includes(q) ||
        (c.dogNames ?? "").toLowerCase().includes(q) ||
        c.lastMessagePreview.toLowerCase().includes(q)
      );
    });
  }, [conversations, query, filter]);

  const selected = conversations?.find((c) => c.id === selectedId) ?? null;
  const unreadCount = conversations?.filter((c) => c.unread).length ?? 0;

  async function setCompleted(completed: boolean) {
    if (!selected) return;
    setUpdating(true);
    const ok = await setConversationCompleted(selected.id, completed);
    if (ok) setConversations((list) => (list ?? []).map((c) => (c.id === selected.id ? { ...c, completed } : c)));
    setUpdating(false);
  }

  const list = (
    <div className={`flex min-h-0 flex-1 flex-col lg:max-w-sm lg:border-r lg:border-white/10 ${selected ? "hidden lg:flex" : "flex"}`}>
      <div className="flex items-baseline gap-2 px-4 pt-3">
        <h2 className="text-xl font-bold tracking-tight text-paper">Inbox</h2>
        {unreadCount > 0 && <span className="text-sm text-paper-dim">{unreadCount} unread</span>}
      </div>
      <div className="px-4 pt-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search owners, dogs or messages"
          aria-label="Search conversations"
          className="glass w-full rounded-full px-4 py-2 text-sm text-paper placeholder:text-paper-dim focus:outline-none hover:bg-white/[0.08]"
        />
        <div className="mt-2 flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                filter === f.key ? "bg-accent text-accent-ink" : "glass text-paper/70"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex-1 overflow-y-auto">
        {error && <p className="px-4 py-2 text-sm text-red-300">{error}</p>}
        {visible === null ? (
          <p className="px-4 py-8 text-center text-sm text-paper-dim">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-paper-dim">
            {query.trim() ? `No conversations match “${query.trim()}”.` : filter === "all" ? "No messages yet." : "Nothing here."}
          </p>
        ) : (
          <ul>
            {visible.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] ${
                    c.id === selectedId ? "bg-white/[0.06]" : ""
                  } ${c.completed ? "opacity-65" : ""}`}
                >
                  <Avatar name={c.ownerName} avatarUrl={c.avatarUrl ?? undefined} size="lg" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm text-paper ${c.unread ? "font-bold" : "font-semibold"}`}>
                        {c.ownerName}
                        {c.dogNames && <span className="font-normal text-paper-dim"> · {c.dogNames}</span>}
                      </span>
                      <span className={`shrink-0 text-xs ${c.unread ? "text-paper" : "text-paper-dim"}`}>
                        {formatActivity(c.lastMessageAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={`truncate text-sm ${c.unread ? "font-medium text-paper" : "text-paper-dim"}`}>
                        {c.lastFromStaff ? "You: " : ""}
                        {c.lastMessagePreview}
                      </span>
                      {c.unread ? (
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#0a84ff]" aria-label="Unread" />
                      ) : c.completed ? (
                        <span className="shrink-0 text-xs text-paper-dim" aria-label="Completed">✓</span>
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1">
      {list}
      {selected ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-3 border-b border-white/10 px-3 py-2">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label="Back to inbox"
              className="glass flex h-9 w-9 items-center justify-center rounded-full text-paper lg:hidden"
            >
              ‹
            </button>
            <Avatar name={selected.ownerName} avatarUrl={selected.avatarUrl ?? undefined} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-paper">{selected.ownerName}</p>
              <p className="truncate text-xs text-paper-dim">
                {selected.completed ? "Marked complete" : selected.dogNames ? `Owner of ${selected.dogNames}` : "Open conversation"}
              </p>
            </div>
            {selected.phone && (
              <a
                href={`tel:${selected.phone}`}
                aria-label={`Call ${selected.ownerName}`}
                className="glass flex h-9 items-center rounded-full px-3 text-xs font-semibold text-paper"
              >
                Call
              </a>
            )}
            <button
              type="button"
              disabled={updating}
              onClick={() => setCompleted(!selected.completed)}
              className="glass flex h-9 items-center rounded-full px-3 text-xs font-semibold text-paper disabled:opacity-50"
            >
              {selected.completed ? "Reopen" : "Mark complete"}
            </button>
          </div>
          <ChatThread
            key={selected.id}
            conversationId={selected.id}
            viewerId={viewerId}
            viewerRole="staff"
            presenceName={viewerName}
            emptyLabel="No messages yet."
            locked={updating || selected.completed}
            lockedMessage={updating ? "Updating…" : "This conversation is marked complete — tap Reopen above to reply."}
          />
        </div>
      ) : (
        <div className="hidden flex-1 items-center justify-center text-sm text-paper-dim lg:flex">
          Pick a conversation
        </div>
      )}
    </div>
  );
}
