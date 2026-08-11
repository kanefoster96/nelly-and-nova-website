"use client";

import { formatTime } from "@/lib/inbox/format";
import type { InboxRequest } from "@/lib/inbox/types";

export function RequestsList({
  items,
  onOpen,
}: {
  items: InboxRequest[];
  onOpen: (request: InboxRequest) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-paper-dim">No new requests.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => onOpen(r)}
            className="w-full rounded-2xl bg-white/[0.04] p-4 text-left ring-1 ring-white/10 transition-colors hover:ring-accent/50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {r.status === "pending" && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
                  )}
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-paper/80">
                    {r.kind}
                  </span>
                </div>
                <p className="mt-2 font-semibold text-paper">{r.requesterName}</p>
                <p className="mt-0.5 truncate text-sm text-paper/70">
                  {r.summary}
                </p>
              </div>
              <span className="shrink-0 text-xs text-paper-dim">
                {formatTime(r.createdAt)}
              </span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
