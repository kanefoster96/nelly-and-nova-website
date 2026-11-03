"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchMyNotifications, markNotificationsRead } from "@/lib/notifications/client";
import type { Notification } from "@/lib/inbox/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Built by hand (not toLocaleString) so server and client always agree.
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

/**
 * The circle at the head of a row, as in Kanvas's list: a glyph and colour
 * for the kind of news, taken from where the link goes (the one field the
 * code that raised it sets), or a person's initial when a person sent it.
 */
type Mark = { path: string; className: string };
const MARKS: [prefix: string, mark: Mark][] = [
  ["/messages", { path: "M4 5h16v11H8l-4 4V5Z", className: "bg-sky-400/15 text-sky-300" }],
  ["/profile/sessions", { path: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4", className: "bg-violet-400/15 text-violet-300" }],
  ["/profile/practice", { path: "m12 4 9 4-9 4-9-4 9-4Zm-6 6v5c0 1.5 3 3 6 3s6-1.5 6-3v-5", className: "bg-emerald-400/15 text-emerald-300" }],
  ["/community", { path: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z", className: "bg-pink-400/15 text-pink-300" }],
  ["/profile", { path: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0", className: "bg-sky-400/15 text-sky-300" }],
];
const BELL: Mark = { path: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2Zm4 4h4", className: "bg-white/10 text-paper-dim" };
const BUSINESS = ["nelly & nova", "website"];

function KindMark({ n }: { n: Notification }) {
  const sender = (n.sentByName ?? "Nelly & Nova").trim();
  if (!BUSINESS.includes(sender.toLowerCase())) {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-paper">
        {sender.charAt(0).toUpperCase()}
      </span>
    );
  }
  const mark = MARKS.find(([prefix]) => n.actionHref?.startsWith(prefix))?.[1] ?? BELL;
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${mark.className}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
        <path d={mark.path} />
      </svg>
    </span>
  );
}

/**
 * Your notifications (the `notifications` table), styled like Kanvas's list:
 * one card, a row each — the kind's mark, who it's from, when, the title
 * and message, and the whole row opens where it points. Opening the list
 * marks everything read; what was new keeps its dot while you're here.
 */
export function NotificationsList({ initial }: { initial: Notification[] }) {
  const [items, setItems] = useState(initial);
  const [error, setError] = useState(false);
  const [newAtOpen, setNewAtOpen] = useState<Set<string>>(() => new Set(initial.filter((n) => !n.readAt).map((n) => n.id)));

  useEffect(() => {
    let cancelled = false;
    fetchMyNotifications()
      .then((list) => {
        if (cancelled) return;
        setNewAtOpen((prev) => new Set([...prev, ...list.filter((n) => !n.readAt).map((n) => n.id)]));
        setItems(list);
        if (list.some((n) => !n.readAt)) markNotificationsRead().catch(() => {});
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-8 text-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-6 w-6 text-paper-dim" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d={BELL.path} />
        </svg>
        <p className="text-sm text-paper-dim">{error ? "Couldn't load your notifications — please refresh." : "No notifications yet."}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      {items.map((n) => {
        const isNew = newAtOpen.has(n.id);
        const content = (
          <>
            <KindMark n={n} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-paper">{n.sentByName ?? "Nelly & Nova"}</span>
                {isNew && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-label="New" />}
                <span className="shrink-0 text-[11px] text-paper-dim">{formatDateTime(n.createdAt)}</span>
                {n.actionHref && <span className="shrink-0 text-paper-dim" aria-hidden="true">›</span>}
              </span>
              {n.title && <span className="mt-1 block text-sm font-semibold text-paper">{n.title}</span>}
              <span className="mt-0.5 block text-[13px] text-paper-dim">{n.body}</span>
            </span>
          </>
        );
        return (
          <li key={n.id}>
            {n.actionHref ? (
              <Link href={n.actionHref} className="flex gap-3 p-4 transition-colors hover:bg-white/[0.04]">
                {content}
              </Link>
            ) : (
              <div className="flex gap-3 p-4">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
