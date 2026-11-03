"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/community/Avatar";
import { parseChatBody } from "@/lib/chat/links";
import {
  chatSupabase,
  getAttachmentUrl,
  getMessages,
  getMessagesSince,
  getTeam,
  heartbeat,
  markChatRead,
  sendChatMessage,
  toChatMessage,
  uploadAttachment,
} from "@/lib/chat/client";
import type {
  ChatAttachmentType,
  ChatMessage,
  ChatMessageRow,
  ChatPresence,
} from "@/lib/chat/types";

/**
 * One conversation, ported from the Kanvas Academy chat: messages arrive live
 * over Realtime (with a 5-second poll as a back-up), your own message shows
 * straight away while it sends, time dividers group a back-and-forth, team
 * replies carry the trainer's photo and name, and the + button attaches a
 * photo, video or file.
 *
 * `viewerRole` picks the side. A member's chat beats a heartbeat while it's
 * on screen. Trainers see who else is in the chat ("Charlotte is typing…")
 * so two of them don't answer the same person; members never see that.
 */

type Team = Record<string, { name: string; avatarUrl: string | null }>;

const TYPING_IDLE_MS = 3000;
const HEARTBEAT_MS = 30 * 1000;
const POLL_MS = 5000;
const DIVIDER_GAP_MS = 5 * 60 * 1000;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const TEAM_FALLBACK_NAME = "Nelly & Nova";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Built by hand (not toLocaleString) so server and client always agree.
function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} · ${hours}:${minutes}`;
}

function needsDivider(current: ChatMessage, previous: ChatMessage | undefined) {
  if (!previous) return true;
  return new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime() > DIVIDER_GAP_MS;
}

function presenceSummary(others: ChatPresence[], viewerRole: ChatPresence["role"]): string | null {
  if (viewerRole === "member" || others.length === 0) return null;
  const unique = (list: ChatPresence[]) => [...new Set(list.map((p) => p.name))];
  const join = (names: string[]) =>
    names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  const typing = unique(others.filter((p) => p.typing));
  if (typing.length > 0) return `${join(typing)} ${typing.length === 1 ? "is" : "are"} typing…`;
  const here = unique(others);
  return `${join(here)} ${here.length === 1 ? "is" : "are"} in this chat`;
}

/**
 * Folds a freshly-arrived message (Realtime or the poll) into the list —
 * idempotent by id, and it replaces our own oldest still-sending message
 * instead of showing it twice.
 */
function mergeMessage(
  prev: ChatMessage[],
  incoming: ChatMessage,
  viewerId: string,
  pending: { current: string[] }
): ChatMessage[] {
  const existing = prev.findIndex((m) => m.id === incoming.id);
  if (existing !== -1) {
    const next = [...prev];
    next[existing] = { ...prev[existing], ...incoming, attachmentUrl: prev[existing].attachmentUrl ?? incoming.attachmentUrl };
    return next;
  }
  if (incoming.senderId === viewerId && pending.current.length > 0) {
    const [oldest, ...rest] = pending.current;
    const index = prev.findIndex((m) => m.id === oldest);
    if (index !== -1) {
      pending.current = rest;
      const next = [...prev];
      next[index] = { ...incoming, attachmentUrl: prev[index].attachmentUrl ?? incoming.attachmentUrl };
      return next;
    }
  }
  return [...prev, incoming].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

function ChatBody({ body, linkify, className = "" }: { body: string; linkify: boolean; className?: string }) {
  if (!linkify) return <span className={`whitespace-pre-wrap break-words ${className}`}>{body}</span>;
  return (
    <span className={`whitespace-pre-wrap break-words ${className}`}>
      {parseChatBody(body).map((part, i) =>
        part.type === "link" ? (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-2 hover:opacity-80"
          >
            {part.text}
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </span>
  );
}

function Glyph({ d, children }: { d?: string; children?: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4" aria-hidden="true">
      {d ? <path strokeLinecap="round" strokeLinejoin="round" d={d} /> : children}
    </svg>
  );
}
const PhotoGlyph = () => (
  <Glyph>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.75" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m4 17 5-5 4 4 3-3 4 4" />
  </Glyph>
);
const VideoGlyph = () => (
  <Glyph>
    <rect x="3" y="6" width="13" height="12" rx="1.5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m16.5 10.5 4.5-2.7v8.4l-4.5-2.7" />
  </Glyph>
);
const FileGlyph = () => (
  <Glyph>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5" />
  </Glyph>
);

function AttachmentContent({
  message,
  resolveUrl,
}: {
  message: ChatMessage;
  resolveUrl: (path: string) => void;
}) {
  useEffect(() => {
    if (message.attachmentPath && message.attachmentUrl === undefined) resolveUrl(message.attachmentPath);
  }, [message.attachmentPath, message.attachmentUrl, resolveUrl]);

  if (!message.attachmentPath || !message.attachmentType) return null;
  if (!message.attachmentUrl) {
    return (
      <div className="flex h-32 w-48 items-center justify-center rounded-lg bg-white/5 text-xs text-paper-dim">
        {message.attachmentUrl === null ? "Couldn't load this file" : "Loading…"}
      </div>
    );
  }
  if (message.attachmentType === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={message.attachmentUrl} alt={message.attachmentName ?? "Photo"} className="max-h-64 max-w-full rounded-lg object-cover" />
    );
  }
  if (message.attachmentType === "video") {
    return <video src={message.attachmentUrl} controls className="max-h-64 max-w-full rounded-lg" />;
  }
  return (
    <a
      href={message.attachmentUrl}
      target="_blank"
      rel="noopener noreferrer"
      download={message.attachmentName ?? undefined}
      className="flex items-center gap-2 rounded-lg bg-black/10 px-3 py-2 text-sm underline underline-offset-4"
    >
      <FileGlyph />
      {message.attachmentName ?? "File"}
    </a>
  );
}

export function ChatThread({
  conversationId,
  viewerId,
  viewerRole,
  presenceName,
  emptyLabel = "No messages yet — say hello!",
  locked = false,
  lockedMessage,
}: {
  conversationId: string;
  viewerId: string;
  viewerRole: ChatPresence["role"];
  /** What others in the chat see in "X is typing…". */
  presenceName: string;
  emptyLabel?: string;
  /** Hides the composer — a completed conversation on the trainer side. */
  locked?: boolean;
  lockedMessage?: string;
}) {
  const isStaff = viewerRole === "staff";
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [team, setTeam] = useState<Team>({});
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [others, setOthers] = useState<ChatPresence[]>([]);

  const messagesRef = useRef<ChatMessage[]>([]);
  const pendingRef = useRef<string[]>([]);
  const resolvingRef = useRef<Set<string>>(new Set());
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const presenceChannelRef = useRef<ReturnType<ReturnType<typeof chatSupabase>["channel"]> | null>(null);
  const typingRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    messagesRef.current = messages ?? [];
  }, [messages]);

  // First load: the messages and the team's photos, then mark it read.
  useEffect(() => {
    let cancelled = false;
    Promise.all([getMessages(conversationId), getTeam()])
      .then(([loaded, loadedTeam]) => {
        if (cancelled) return;
        setTeam(loadedTeam);
        setMessages(loaded);
      })
      .catch(() => {
        if (!cancelled) {
          setMessages([]);
          setError("Couldn't load the conversation — please refresh.");
        }
      });
    markChatRead(conversationId).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const fold = useCallback(
    (incoming: ChatMessage[]) => {
      if (incoming.length === 0) return;
      setMessages((prev) =>
        incoming.reduce((acc, m) => mergeMessage(acc, m, viewerId, pendingRef), prev ?? [])
      );
      if (incoming.some((m) => m.senderId !== viewerId)) markChatRead(conversationId).catch(() => {});
    },
    [conversationId, viewerId]
  );

  // Live: Realtime INSERTs for this conversation.
  useEffect(() => {
    const supabase = chatSupabase();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    try {
      channel = supabase
        .channel(`chat_messages:${conversationId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` },
          (payload) => fold([toChatMessage(payload.new as ChatMessageRow)])
        )
        .subscribe();
    } catch (err) {
      console.error("ChatThread: realtime failed", err);
    }
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [conversationId, fold]);

  // Back-up: poll for anything Realtime missed.
  useEffect(() => {
    const poll = setInterval(async () => {
      const lastReal = [...messagesRef.current].reverse().find((m) => !m.id.startsWith("temp-"));
      try {
        fold(await getMessagesSince(conversationId, lastReal?.createdAt ?? new Date(0).toISOString()));
      } catch {
        // the next poll tries again
      }
    }, POLL_MS);
    return () => clearInterval(poll);
  }, [conversationId, fold]);

  // Presence: everyone with this conversation open shares one channel.
  useEffect(() => {
    const supabase = chatSupabase();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    try {
      channel = supabase.channel(`presence:${conversationId}`, {
        config: { presence: { key: `${viewerId}:${crypto.randomUUID()}` } },
      });
      presenceChannelRef.current = channel;
      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState<ChatPresence>();
          setOthers(
            Object.entries(state)
              .filter(([key]) => !key.startsWith(`${viewerId}:`))
              .flatMap(([, entries]) => entries)
              .map((e) => ({ role: e.role, name: e.name, typing: e.typing }))
          );
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel!.track({ role: viewerRole, name: presenceName, typing: false });
          }
        });
    } catch (err) {
      console.error("ChatThread: presence failed", err);
    }
    return () => {
      presenceChannelRef.current = null;
      if (channel) supabase.removeChannel(channel);
    };
  }, [conversationId, viewerId, viewerRole, presenceName]);

  const setTyping = useCallback(
    (typing: boolean) => {
      if (typingRef.current === typing) return;
      typingRef.current = typing;
      presenceChannelRef.current?.track({ role: viewerRole, name: presenceName, typing }).catch(() => {});
    },
    [viewerRole, presenceName]
  );

  useEffect(
    () => () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    },
    []
  );

  // Member heartbeat — only while the tab is actually visible.
  useEffect(() => {
    if (isStaff) return;
    const beat = () => {
      if (document.visibilityState === "visible") heartbeat().catch(() => {});
    };
    beat();
    const interval = setInterval(beat, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [isStaff, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages?.length]);

  // The composer grows with what's typed, up to a few lines.
  useEffect(() => {
    const el = draftRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  const resolveAttachmentUrl = useCallback(async (path: string) => {
    if (resolvingRef.current.has(path)) return;
    resolvingRef.current.add(path);
    const url = await getAttachmentUrl(path);
    setMessages((prev) => (prev ?? []).map((m) => (m.attachmentPath === path ? { ...m, attachmentUrl: url } : m)));
  }, []);

  function addOptimistic(partial: Partial<ChatMessage>): string {
    const tempId = `temp-${crypto.randomUUID()}`;
    pendingRef.current.push(tempId);
    setMessages((prev) => [
      ...(prev ?? []),
      {
        id: tempId,
        conversationId,
        senderId: viewerId,
        senderIsStaff: isStaff,
        senderName: null,
        body: "",
        attachmentPath: null,
        attachmentType: null,
        attachmentName: null,
        createdAt: new Date().toISOString(),
        ...partial,
      },
    ]);
    return tempId;
  }

  function dropOptimistic(tempId: string) {
    pendingRef.current = pendingRef.current.filter((id) => id !== tempId);
    setMessages((prev) => (prev ?? []).filter((m) => m.id !== tempId));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const tempId = addOptimistic({ body });
    setDraft("");
    setTyping(false);
    const result = await sendChatMessage(conversationId, { body });
    setSending(false);
    if (!result.success) {
      setError(result.error);
      dropOptimistic(tempId);
      setDraft(body);
    }
  }

  async function handleAttach(file: File, type: ChatAttachmentType) {
    setAttachMenuOpen(false);
    setError(null);
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError("That file is too large — please keep it under 25MB.");
      return;
    }
    const caption = draft.trim();
    const tempId = addOptimistic({
      body: caption,
      attachmentPath: `pending/${file.name}`,
      attachmentType: type,
      attachmentName: file.name,
      attachmentUrl: type === "image" ? URL.createObjectURL(file) : undefined,
    });
    setDraft("");
    setSending(true);

    const path = await uploadAttachment(conversationId, file);
    if (!path) {
      setSending(false);
      setError("Could not upload that file — please try again.");
      dropOptimistic(tempId);
      setDraft(caption);
      return;
    }
    const result = await sendChatMessage(conversationId, {
      body: caption,
      attachmentPath: path,
      attachmentType: type,
      attachmentName: file.name,
    });
    setSending(false);
    if (!result.success) {
      setError(result.error);
      dropOptimistic(tempId);
    }
  }

  const presenceLine = presenceSummary(others, viewerRole);
  const list = messages ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages === null ? (
          <p className="mt-6 text-center text-sm text-paper-dim">Loading…</p>
        ) : list.length === 0 ? (
          <p className="mt-6 text-center text-sm text-paper-dim">{emptyLabel}</p>
        ) : (
          <div className="flex flex-col gap-1">
            {list.map((message, i) => {
              const isMine = message.senderId === viewerId;
              const hasDivider = needsDivider(message, list[i - 1]);
              // A trainer's message from someone else gets a name and photo
              // on the first bubble of a run, like any chat app.
              const fromTeam = !isMine && message.senderIsStaff;
              const showSender =
                fromTeam && (hasDivider || i === 0 || list[i - 1].senderId !== message.senderId);
              const member = message.senderId ? team[message.senderId] : undefined;
              const senderName = message.senderName ?? member?.name ?? TEAM_FALLBACK_NAME;
              const pending = message.id.startsWith("temp-");
              return (
                <div key={message.id}>
                  {hasDivider && (
                    <p className="my-3 text-center text-[11px] text-paper-dim">{formatMessageTime(message.createdAt)}</p>
                  )}
                  <div className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
                    {fromTeam && (
                      <div className="h-7 w-7 shrink-0">
                        {showSender && <Avatar name={senderName} avatarUrl={member?.avatarUrl ?? undefined} size="sm" />}
                      </div>
                    )}
                    <div className="flex max-w-[80%] flex-col gap-1">
                      {showSender && <span className="px-1 text-xs font-medium text-paper-dim">{senderName}</span>}
                      <div
                        className={`flex flex-col gap-2 rounded-[1.375rem] text-sm ${
                          isMine ? "bg-accent text-accent-ink" : "border border-white/10 bg-white/[0.06] text-paper"
                        } ${message.attachmentPath ? "p-2" : "px-4 py-2.5"} ${pending ? "opacity-70" : ""}`}
                      >
                        {message.attachmentPath && (
                          <AttachmentContent message={message} resolveUrl={resolveAttachmentUrl} />
                        )}
                        {message.body && (
                          <ChatBody
                            body={message.body}
                            linkify={message.senderIsStaff}
                            className={message.attachmentPath ? "px-2 pb-1" : ""}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {presenceLine && (
        <p aria-live="polite" className="flex items-center gap-1.5 border-t border-white/10 px-4 py-1.5 text-xs text-paper-dim">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          {presenceLine}
        </p>
      )}

      {locked ? (
        <p className="border-t border-white/10 px-4 py-3 text-center text-sm text-paper-dim">
          {lockedMessage ?? "This conversation is marked complete."}
        </p>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-white/10 p-3">
            <div className="relative">
              <button
                type="button"
                aria-label="Attach a photo, video or file"
                onClick={() => setAttachMenuOpen((v) => !v)}
                className="glass flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-paper-dim transition-colors hover:text-paper"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                </svg>
              </button>
              {attachMenuOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close attach menu"
                    onClick={() => setAttachMenuOpen(false)}
                    className="fixed inset-0 z-10 cursor-default"
                  />
                  <div className="glass absolute bottom-14 left-0 z-20 flex w-40 flex-col gap-1 rounded-2xl p-2 shadow-lg hover:bg-white/[0.08]">
                    {(
                      [
                        ["Photo", <PhotoGlyph key="g" />, photoInputRef],
                        ["Video", <VideoGlyph key="g" />, videoInputRef],
                        ["File", <FileGlyph key="g" />, fileInputRef],
                      ] as const
                    ).map(([label, glyph, ref]) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => ref.current?.click()}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-paper transition-colors hover:bg-white/5"
                      >
                        {glyph}
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {(
              [
                [photoInputRef, "image/*", "image"],
                [videoInputRef, "video/*", "video"],
                [fileInputRef, undefined, "file"],
              ] as const
            ).map(([ref, accept, type]) => (
              <input
                key={type}
                ref={ref}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) handleAttach(file, type);
                }}
              />
            ))}

            <textarea
              ref={draftRef}
              value={draft}
              rows={1}
              aria-label="Message"
              onChange={(e) => {
                setDraft(e.target.value);
                if (e.target.value.trim()) {
                  setTyping(true);
                  if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
                  typingTimerRef.current = setTimeout(() => setTyping(false), TYPING_IDLE_MS);
                } else {
                  setTyping(false);
                }
              }}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter makes a new line — like every chat app.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Type a message…"
              className="max-h-40 min-h-[44px] min-w-0 flex-1 resize-none rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-[16px] leading-6 text-paper placeholder:text-paper-dim focus:border-accent focus:outline-none sm:text-sm"
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={sending || !draft.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </form>
          {!isStaff && (
            <p className="px-4 pb-2 text-center text-[11px] text-paper-dim">
              Please keep it friendly. By messaging us you agree to our{" "}
              <a href="/terms" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-paper">
                terms
              </a>
              .
            </p>
          )}
        </>
      )}

      {error && (
        <p className="border-t border-red-400/30 bg-red-500/10 px-4 py-2 text-center text-xs text-red-300">{error}</p>
      )}
    </div>
  );
}
