"use client";

import { useEffect } from "react";
import { formatTime } from "@/lib/inbox/format";
import { CloseIcon, MessageIcon, MailIcon, CheckIcon } from "../ui/Icons";
import { AddressPin } from "../maps/AddressPin";
import type { InboxRequest } from "@/lib/inbox/types";

export function RequestDetail({
  request,
  onClose,
  onApprove,
  onReject,
  onReplyChat,
}: {
  request: InboxRequest;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onReplyChat: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const mailto = request.email
    ? `mailto:${request.email}?subject=${encodeURIComponent("Re: your enquiry — Nelly & Nova")}`
    : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Request details"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl bg-ink-soft ring-1 ring-white/15 sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div>
            <span className="inline-block rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-paper/80">
              {request.kind}
            </span>
            <h2 className="mt-2 text-xl font-bold text-paper">
              {request.requesterName}
            </h2>
            <p className="mt-0.5 text-sm text-paper-dim">
              {formatTime(request.createdAt)}
              {request.status !== "pending" && ` · ${request.status}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-paper/70 hover:bg-white/10 hover:text-paper"
          >
            <CloseIcon width={20} height={20} />
          </button>
        </header>

        <dl className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {request.details.map((f, i) => {
            const isAddress = /address/i.test(f.label) && f.value.trim() && f.value.trim() !== "—";
            return (
              <div key={i} className="border-b border-white/5 py-3 last:border-0">
                <dt className="text-xs font-medium uppercase tracking-wide text-paper-dim">
                  {f.label}
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-paper">{f.value}</dd>
                {isAddress && (
                  <div className="mt-2">
                    <AddressPin address={f.value} />
                  </div>
                )}
              </div>
            );
          })}
        </dl>

        <footer className="flex flex-wrap gap-2 border-t border-white/10 p-4">
          <button
            type="button"
            onClick={onReplyChat}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full bg-paper px-4 text-sm font-semibold text-ink"
          >
            <MessageIcon width={18} height={18} />
            Reply via chat
          </button>
          {mailto && (
            <a
              href={mailto}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full border border-white/20 px-4 text-sm font-medium text-paper hover:border-white/40"
            >
              <MailIcon width={18} height={18} />
              Reply via email
            </a>
          )}
          {request.status === "pending" && (
            <div className="flex w-full gap-2 pt-1">
              <button
                type="button"
                onClick={onApprove}
                className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-full bg-white/10 px-4 text-sm font-medium text-paper hover:bg-white/15"
              >
                <CheckIcon width={16} height={16} />
                Mark handled
              </button>
              <button
                type="button"
                onClick={onReject}
                className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-full border border-white/15 px-4 text-sm font-medium text-paper/70 hover:text-paper"
              >
                Dismiss
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
