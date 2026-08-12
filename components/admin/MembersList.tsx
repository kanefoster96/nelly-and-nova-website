"use client";

import { cancelMember, useCancellations } from "@/lib/members/cancellations";
import { useConfirm } from "@/components/ui/ConfirmDialog";

export type Member = {
  id: string;
  name: string;
  dogName: string;
  photo: string;
};

/**
 * Members management — cancelling an account. Cancelling asks for confirmation,
 * then runs through the backend seam (lib/members/data.ts → cancelAccount) and
 * frees the member's schedule slot; in the scaffold it persists via localStorage.
 */
export function MembersList({ members }: { members: Member[] }) {
  const cancelled = useCancellations();
  const { confirm, dialog } = useConfirm();

  async function cancel(m: Member) {
    const ok = await confirm({
      title: `Cancel ${m.name}'s membership?`,
      message: (
        <>
          This ends {m.dogName}&apos;s place, releases their schedule slot and stops
          their payments. This can&apos;t be undone here.
        </>
      ),
      danger: true,
      confirmLabel: "Cancel membership",
    });
    if (ok) cancelMember(m.id);
  }

  return (
    <ul className="mt-8 space-y-2">
      {members.map((m) => {
        const isCancelled = cancelled.includes(m.id);
        return (
          <li key={m.id} className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
            <div className="flex items-center gap-3">
              <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full ring-1 ring-white/15">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.photo} alt="" className="h-full w-full object-cover" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-paper">{m.name}</p>
                <p className="truncate text-xs text-paper-dim">{m.dogName}</p>
              </div>
              {isCancelled ? (
                <span className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-paper-dim">
                  Cancelled
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => cancel(m)}
                  className="shrink-0 rounded-full border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:border-red-500/70"
                >
                  Cancel account
                </button>
              )}
            </div>
          </li>
        );
      })}
      {dialog}
    </ul>
  );
}
