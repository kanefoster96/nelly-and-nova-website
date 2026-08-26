"use client";

import { useState } from "react";
import { formatDate, formatTime } from "@/lib/inbox/format";
import { approveReschedule, declineReschedule } from "@/lib/liveReschedule/actions";
import type { PendingReschedule } from "@/lib/liveReschedule/queries";

export function RescheduleRequestsReal({ initial }: { initial: PendingReschedule[] }) {
  const [requests, setRequests] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function approve(r: PendingReschedule) {
    setBusyId(r.id);
    const { error } = await approveReschedule({ requestId: r.id, accountId: r.accountId, dogName: r.dogName });
    setBusyId(null);
    if (!error) setRequests((rs) => rs.filter((x) => x.id !== r.id));
  }

  async function decline(id: string) {
    setBusyId(id);
    const { error } = await declineReschedule(id);
    setBusyId(null);
    if (!error) setRequests((rs) => rs.filter((x) => x.id !== id));
  }

  if (requests.length === 0) {
    return (
      <p className="mt-6 rounded-2xl bg-white/[0.04] p-6 text-center text-paper-dim ring-1 ring-white/10">
        No pending reschedule requests.
      </p>
    );
  }

  return (
    <ul className="mt-6 space-y-3">
      {requests.map((r) => (
        <li key={r.id} className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
          <p className="font-semibold text-paper">
            {r.dogName} <span className="font-normal text-paper-dim">({r.ownerName})</span>
          </p>
          <p className="mt-1 text-sm text-paper/75">
            Currently {formatDate(r.scheduledAt)} · {formatTime(r.scheduledAt)}
            {r.location ? ` · ${r.location}` : ""}
          </p>
          {r.preferredDate && (
            <p className="mt-1 text-sm text-paper/75">Preferred: {formatDate(r.preferredDate)}</p>
          )}
          {r.reason && <p className="mt-1 text-sm text-paper-dim">&ldquo;{r.reason}&rdquo;</p>}
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => approve(r)}
              disabled={busyId === r.id}
              className="rounded-full bg-paper px-4 py-1.5 text-xs font-semibold text-ink disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => decline(r.id)}
              disabled={busyId === r.id}
              className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-medium text-paper disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
