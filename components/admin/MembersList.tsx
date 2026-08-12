"use client";

import Link from "next/link";
import { ChevronDownIcon } from "@/components/ui/Icons";
import { useCancellations } from "@/lib/members/cancellations";

export type Member = {
  id: string;
  name: string;
  dogName: string;
  photo: string;
};

/**
 * Contact list. Each row opens that customer's detail page — their plan, dog,
 * payments, and actions (edit details, change day, chat, email, cancel).
 */
export function MembersList({ members }: { members: Member[] }) {
  const cancelled = useCancellations();

  return (
    <ul className="mt-8 space-y-2">
      {members.map((m) => {
        const isCancelled = cancelled.includes(m.id);
        return (
          <li key={m.id}>
            <Link
              href={`/admin/members/${m.id}`}
              className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10 transition-colors hover:ring-white/25"
            >
              <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full ring-1 ring-white/15">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.photo} alt="" className="h-full w-full object-cover" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-paper">{m.name}</p>
                <p className="truncate text-xs text-paper-dim">{m.dogName}</p>
              </div>
              {isCancelled && (
                <span className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-paper-dim">
                  Cancelled
                </span>
              )}
              <ChevronDownIcon
                width={18}
                height={18}
                className="shrink-0 -rotate-90 text-paper-dim"
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
