"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/community/Avatar";
import { createClient } from "@/lib/supabase/client";
import {
  BODY_MAX,
  NOTIFICATION_EMOJIS,
  NOTIFICATION_LINKS,
  TITLE_MAX,
  checkNotification,
} from "@/lib/notifications/links";

type Owner = { id: string; name: string; email: string | null; avatarUrl: string | null; dogs: string[] };
type Audience = "everyone" | "chosen";

const LEADING = /^\p{Extended_Pictographic}️?\s*/u;

/**
 * Send a notification, after Kanvas's coach/notifications/new: the title
 * (one emoji first, like the automated notices), the message, who gets it
 * (every owner or the ones you tick) and where tapping it goes. Each gets a
 * row on their Notifications and an app push (/api/notifications/send).
 */
export function NotificationComposer() {
  const [emoji, setEmoji] = useState(NOTIFICATION_EMOJIS[0]);
  const [titleText, setTitleText] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("everyone");
  const [chosen, setChosen] = useState<string[]>([]);
  const [path, setPath] = useState("");
  const [owners, setOwners] = useState<Owner[] | null>(null);
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ sent: number; pushed: number } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("profiles").select("id, owner_name, email, avatar_url").neq("role", "admin").order("owner_name"),
      supabase.from("dogs").select("account_id, name"),
    ]).then(([p, d]) => {
      const dogs = new Map<string, string[]>();
      for (const dog of (d.data ?? []) as { account_id: string; name: string }[]) {
        dogs.set(dog.account_id, [...(dogs.get(dog.account_id) ?? []), dog.name]);
      }
      setOwners(
        ((p.data ?? []) as { id: string; owner_name: string | null; email: string | null; avatar_url: string | null }[]).map((o) => ({
          id: o.id,
          name: o.owner_name || o.email || "Owner",
          email: o.email,
          avatarUrl: o.avatar_url,
          dogs: dogs.get(o.id) ?? [],
        }))
      );
    });
  }, []);

  const title = `${emoji} ${titleText.replace(LEADING, "").trim()}`;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (owners ?? []).filter(
      (o) => !q || o.name.toLowerCase().includes(q) || (o.email ?? "").toLowerCase().includes(q) || o.dogs.some((d) => d.toLowerCase().includes(q))
    );
  }, [owners, query]);

  const recipientCount = audience === "everyone" ? (owners?.length ?? 0) : chosen.length;
  const problem = checkNotification(title, body) ?? (recipientCount === 0 ? "Choose who gets it." : null);

  async function send() {
    if (problem || sending) return;
    const who = audience === "everyone" ? `all ${recipientCount} owners` : `${recipientCount} ${recipientCount === 1 ? "owner" : "owners"}`;
    if (!window.confirm(`Send to ${who} now? It goes out straight away and can't be taken back.`)) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body: body.trim(), audience, recipientIds: chosen, path }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't send that — please try again.");
      setSent({ sent: data.sent, pushed: data.pushed });
      setTitleText("");
      setBody("");
      setChosen([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that — please try again.");
    } finally {
      setSending(false);
    }
  }

  const card = "rounded-3xl bg-white/[0.04] p-5 ring-1 ring-white/10";
  const label = "text-sm font-semibold text-paper";

  return (
    <div className="mt-8 flex flex-col gap-4">
      {sent && (
        <p className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          Sent to {sent.sent} {sent.sent === 1 ? "owner" : "owners"} · {sent.pushed} on the app with notifications on.
        </p>
      )}

      {/* How it'll look on a locked phone, as it's typed. */}
      <div className="rounded-3xl bg-gradient-to-br from-[#3a2a4a] via-[#1c1a24] to-[#4a2414] p-4">
        <p className="text-center text-xs font-semibold text-white/80">Preview on a locked phone</p>
        <div className="mt-3 flex gap-3 rounded-[1.375rem] border border-white/15 bg-white/15 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="h-9 w-9 shrink-0 rounded-lg bg-ink" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className={`min-w-0 flex-1 truncate text-[15px] font-semibold ${titleText.trim() ? "text-white" : "text-white/55"}`}>
                {titleText.trim() ? title : `${emoji} Your title`}
              </p>
              <span className="text-xs text-white/60">now</span>
            </div>
            <p className={`line-clamp-4 text-[15px] leading-5 ${body.trim() ? "text-white" : "text-white/55"}`}>
              {body.trim() || "Your message shows here, up to four lines on a locked phone."}
            </p>
          </div>
        </div>
      </div>

      <section className={card}>
        <h2 className={label}>The message</h2>
        <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Emoji">
          {NOTIFICATION_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={emoji === e}
              onClick={() => setEmoji(e)}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-lg transition-colors ${
                emoji === e ? "bg-accent/90 ring-2 ring-accent" : "glass"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-4 focus-within:border-accent">
          <span className="text-lg" aria-hidden="true">{emoji}</span>
          <input
            value={titleText}
            onChange={(e) => setTitleText(e.target.value.slice(0, TITLE_MAX - 3))}
            placeholder="Title, e.g. Closed on Friday"
            aria-label="Title"
            className="min-w-0 flex-1 bg-transparent py-3 text-[16px] font-semibold text-paper placeholder:text-paper-dim focus:outline-none"
          />
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
          rows={4}
          placeholder="What do they need to know? (No emojis here — the title has one.)"
          aria-label="Message"
          className="mt-3 w-full resize-none rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-[16px] text-paper placeholder:text-paper-dim focus:border-accent focus:outline-none sm:text-sm"
        />
      </section>

      <section className={card}>
        <h2 className={label}>Who gets it</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(
            [
              ["everyone", "Every owner", owners ? `${owners.length} ${owners.length === 1 ? "person" : "people"}` : "…"],
              ["chosen", "Choose owners", chosen.length ? `${chosen.length} chosen` : "Tick who it's for"],
            ] as const
          ).map(([key, heading, detail]) => (
            <button
              key={key}
              type="button"
              onClick={() => setAudience(key)}
              aria-pressed={audience === key}
              className={`rounded-2xl px-4 py-3 text-left transition-colors ${
                audience === key ? "bg-white/[0.08] ring-[1.5px] ring-paper" : "ring-1 ring-white/10 hover:bg-white/[0.04]"
              }`}
            >
              <span className="block text-sm font-semibold text-paper">{heading}</span>
              <span className="block text-xs text-paper-dim">{detail}</span>
            </button>
          ))}
        </div>
        {audience === "chosen" && (
          <div className="mt-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search owners or dogs"
              aria-label="Search owners"
              className="glass w-full rounded-full px-4 py-2 text-sm text-paper placeholder:text-paper-dim focus:outline-none"
            />
            <ul className="mt-2 max-h-72 overflow-y-auto">
              {owners === null ? (
                <li className="py-4 text-center text-sm text-paper-dim">Loading…</li>
              ) : visible.length === 0 ? (
                <li className="py-4 text-center text-sm text-paper-dim">No owners match.</li>
              ) : (
                visible.map((o) => {
                  const on = chosen.includes(o.id);
                  return (
                    <li key={o.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.04]">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => setChosen((c) => (on ? c.filter((id) => id !== o.id) : [...c, o.id]))}
                          className="h-4 w-4 accent-[var(--color-accent,#f5f2ea)]"
                        />
                        <Avatar name={o.name} avatarUrl={o.avatarUrl ?? undefined} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-paper">{o.name}</span>
                          {o.dogs.length > 0 && <span className="block truncate text-xs text-paper-dim">{o.dogs.join(", ")}</span>}
                        </span>
                      </label>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
        <label className="mt-4 block text-sm text-paper-dim" htmlFor="notification-link">
          Tapping it opens
        </label>
        <select
          id="notification-link"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          className="mt-1.5 w-full rounded-2xl border border-white/15 bg-ink px-4 py-3 text-sm text-paper focus:border-accent focus:outline-none"
        >
          {NOTIFICATION_LINKS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </section>

      {error && <p className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

      <div className="flex flex-col items-center gap-2">
        {problem && (titleText || body) && <p className="text-sm text-paper-dim">{problem}</p>}
        <button
          type="button"
          onClick={send}
          disabled={!!problem || sending}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-accent px-6 text-base font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-45"
        >
          {sending ? "Sending…" : recipientCount ? `Send to ${recipientCount} ${recipientCount === 1 ? "owner" : "owners"}` : "Send"}
        </button>
      </div>
    </div>
  );
}
