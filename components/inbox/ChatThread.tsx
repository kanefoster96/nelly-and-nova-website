"use client";

import { useEffect, useRef, useState } from "react";
import { formatTime } from "@/lib/inbox/format";
import type { Message } from "@/lib/inbox/types";

type ChatThreadProps = {
  conversationId: string;
  initialMessages: Message[];
  /** True when the business/staff is viewing; false for a member/visitor. */
  viewerIsStaff: boolean;
  /** Persist a message and return the confirmed row. Wire to the backend. */
  onSend: (body: string) => Promise<Message>;
  headerName?: string;
};

export function ChatThread({
  conversationId,
  initialMessages,
  viewerIsStaff,
  onSend,
  headerName,
}: ChatThreadProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // Live delivery — SCAFFOLD (no live source yet).
  useEffect(() => {
    // TODO(backend): subscribe to Realtime INSERTs on `messages`
    // (filter: conversation_id = conversationId) AND poll getMessagesSince()
    // every ~5s as a fallback. Merge both into state, deduped by message id.
    return () => {
      /* unsubscribe */
    };
  }, [conversationId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;

    // Optimistic: show the message immediately with a temp id.
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: Message = {
      id: tempId,
      conversationId,
      body,
      fromStaff: viewerIsStaff,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((m) => [...m, optimistic]);
    setText("");
    setSending(true);
    try {
      const confirmed = await onSend(body);
      // Swap the temp row for the confirmed one (dedupe by id).
      setMessages((m) => m.map((x) => (x.id === tempId ? confirmed : x)));
    } catch {
      setMessages((m) =>
        m.map((x) => (x.id === tempId ? { ...x, pending: false } : x))
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-3xl bg-white/[0.03] ring-1 ring-white/10">
      {headerName && (
        <header className="border-b border-white/10 px-5 py-4">
          <p className="font-semibold text-paper">{headerName}</p>
        </header>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
        {messages.map((m) => {
          const mine = m.fromStaff === viewerIsStaff;
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  mine
                    ? "bg-paper text-ink"
                    : "bg-white/[0.06] text-paper ring-1 ring-white/10"
                } ${m.pending ? "opacity-60" : ""}`}
              >
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p
                  className={`mt-1 text-[11px] ${
                    mine ? "text-ink/50" : "text-paper-dim"
                  }`}
                >
                  {m.pending ? "Sending…" : formatTime(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 border-t border-white/10 p-3"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          aria-label="Message"
          className="min-h-[44px] flex-1 rounded-full border border-white/15 bg-white/[0.04] px-4 text-paper placeholder:text-paper-dim focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-paper px-5 text-sm font-semibold text-ink transition-opacity disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
