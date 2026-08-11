"use client";

import { useState } from "react";
import { formatTime } from "@/lib/inbox/format";
import type { InboxRequest } from "@/lib/inbox/types";

export function RequestsList({ initial }: { initial: InboxRequest[] }) {
  const [items, setItems] = useState(initial);

  function resolve(id: string, status: "approved" | "rejected") {
    // TODO(backend): update requests.status; on approve, copy fields onto the
    // real record AND insert a targeted notification for the requester.
    setItems((list) => list.filter((r) => r.id !== id));
    void status;
  }

  if (items.length === 0) {
    return <p className="text-sm text-paper-dim">No pending requests.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((r) => (
        <li
          key={r.id}
          className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-block rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-paper/80">
                {r.kind}
              </span>
              <p className="mt-2 font-semibold text-paper">{r.requesterName}</p>
              <p className="mt-0.5 text-sm text-paper/70">{r.summary}</p>
            </div>
            <span className="shrink-0 text-xs text-paper-dim">
              {formatTime(r.createdAt)}
            </span>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => resolve(r.id, "approved")}
              className="inline-flex min-h-[40px] items-center rounded-full bg-paper px-4 text-sm font-semibold text-ink"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => resolve(r.id, "rejected")}
              className="inline-flex min-h-[40px] items-center rounded-full border border-white/20 px-4 text-sm font-medium text-paper hover:border-white/40"
            >
              Reject
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
