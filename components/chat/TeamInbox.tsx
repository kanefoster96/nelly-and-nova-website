"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/community/Avatar";
import { ChatThread } from "./ChatThread";
import { chatSupabase, getConversationStatus, getInbox, setConversationCompleted } from "@/lib/chat/client";
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

/** The owner's chat beat a heartbeat in the last couple of minutes. */
const ACTIVE_MS = 2 * 60 * 1000;
function isActive(iso: string | null | undefined, now: number): boolean {
  return !!iso && now - new Date(iso).getTime() < ACTIVE_MS;
}

function relativeTime(iso: string, now: number): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

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
  const [status, setStatus] = useState<{ memberLastReadAt: string | null; memberLastActiveAt: string | null } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // The clock for "In the chat now", ticking with the inbox.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(tick);
  }, []);

  // The open conversation: when the owner last read it and last had it open.
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    const load = () =>
      getConversationStatus(selectedId)
        .then((s) => {
          if (!cancelled) setStatus(s);
        })
        .catch(() => {});
    void load();
    const timer = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      setStatus(null);
    };
  }, [selectedId]);

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
  const counts: Record<Filter, number> = {
    all: conversations?.length ?? 0,
    unread: unreadCount,
    open: conversations?.filter((c) => !c.unread && !c.completed).length ?? 0,
    completed: conversations?.filter((c) => c.completed).length ?? 0,
  };
  const selectedActiveAt = status?.memberLastActiveAt ?? selected?.memberLastActiveAt ?? null;
  const selectedLive = isActive(selectedActiveAt, now);
  const subtitle = !selected
    ? ""
    : selected.completed
      ? "Marked done"
      : selectedLive
        ? "In the chat now"
        : selectedActiveAt
          ? `Last in the chat ${relativeTime(selectedActiveAt, now)}`
          : selected.dogNames
            ? `Owner of ${selected.dogNames}`
            : "Open conversation";

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
        {unreadCount > 0 && <span className="text-sm font-semibold text-amber-400">{unreadCount} unread</span>}
      </div>
      <div className="px-4 pt-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search owners, dogs or messages"
          aria-label="Search conversations"
          className="glass w-full rounded-full px-4 py-2 text-sm text-paper placeholder:text-paper-dim focus:outline-none hover:bg-white/[0.08]"
        />
        {/* All / Unread / Open / Completed, with counts — Unread stays amber while there's any. */}
        <div className="glass mt-3 flex gap-1 overflow-x-auto rounded-full p-1">
          {FILTERS.map((f) => {
            const on = filter === f.key;
            const amber = f.key === "unread" && counts.unread > 0;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={on}
                className={`flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  on ? (amber ? "bg-amber-400 text-ink" : "bg-accent text-accent-ink") : amber ? "text-amber-400" : "text-paper/70 hover:text-paper"
                }`}
              >
                {f.label}
                {conversations !== null && <span className={on ? "opacity-70" : "opacity-60"}>{counts[f.key]}</span>}
              </button>
            );
          })}
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
                  {/* Laid out like Kanvas's (and Instagram's) inbox: the name, the last
                      message with when, then the dogs; a green dot while they're in the chat. */}
                  <span className="relative shrink-0">
                    <Avatar name={c.ownerName} avatarUrl={c.avatarUrl ?? undefined} size="lg" />
                    {isActive(c.memberLastActiveAt, now) && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-ink bg-emerald-500" aria-label="In the chat now" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[15px] text-paper ${c.unread ? "font-bold" : "font-medium"}`}>{c.ownerName}</span>
                    <span className="flex min-w-0 items-center text-sm">
                      <span className={`truncate ${c.unread ? "font-semibold text-paper" : "text-paper-dim"}`}>
                        {c.lastFromStaff ? "You: " : ""}
                        {c.lastMessagePreview}
                      </span>
                      <span className="shrink-0 text-paper-dim">&nbsp;·&nbsp;{formatActivity(c.lastMessageAt)}</span>
                    </span>
                    {c.dogNames && <span className="block truncate text-xs text-paper-dim">{c.dogNames}</span>}
                  </span>
                  {c.unread ? (
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" aria-label="Unread" />
                  ) : c.completed ? (
                    <span className="shrink-0 text-sm text-paper-dim" aria-label="Done">✓</span>
                  ) : null}
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
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-paper">
                <span className="truncate">{selected.ownerName}</span>
                {selectedLive && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-label="In the chat now" />}
              </p>
              <p className="truncate text-xs text-paper-dim">{subtitle}</p>
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
            {/* Done / Reopen: a labelled pill, as in Kanvas's coach chat. */}
            <button
              type="button"
              disabled={updating}
              onClick={() => setCompleted(!selected.completed)}
              aria-label={selected.completed ? "Reopen conversation" : "Mark conversation done"}
              className={`flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-bold disabled:opacity-50 ${
                selected.completed ? "border-white/10 bg-white/[0.06] text-paper" : "border-emerald-500/55 bg-emerald-500/15 text-emerald-300"
              }`}
            >
              {selected.completed ? "↺ Reopen" : "✓ Done"}
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
            lockedMessage={updating ? "Updating…" : "This conversation is done. Tap Reopen above to reply."}
            owner={{ accountId: selected.userId, email: selected.email }}
            memberLastReadAt={status ? status.memberLastReadAt : undefined}
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
