"use client";

import { useCallback, useState, type ReactNode } from "react";

export type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  /** Shown big in a highlighted panel — for charges, e.g. "£80". */
  amount?: string;
  amountNote?: string;
  confirmLabel?: string;
  danger?: boolean;
};

export function ConfirmDialog({
  title,
  message,
  amount,
  amountNote,
  confirmLabel = "Confirm",
  danger,
  onConfirm,
  onCancel,
}: ConfirmOptions & { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-t-3xl bg-ink ring-1 ring-white/15 sm:rounded-3xl"
      >
        <div className="px-5 py-5">
          <h2 className="text-lg font-bold text-paper">{title}</h2>
          {message && <div className="mt-2 text-sm text-paper/80">{message}</div>}
          {amount && (
            <div className="mt-4 rounded-2xl bg-white/[0.05] p-4 text-center ring-1 ring-white/10">
              <p className="display-heading text-3xl text-paper">{amount}</p>
              {amountNote && <p className="mt-1 text-xs text-paper-dim">{amountNote}</p>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={onConfirm}
            className={`inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full px-4 text-sm font-semibold ${
              danger ? "bg-red-500 text-white" : "bg-accent text-accent-ink"
            }`}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/15 px-4 text-sm font-medium text-paper/80 hover:text-paper"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Promise-based confirm. `await confirm({...})` resolves true/false; render the
 * returned `dialog` somewhere in the component.
 */
export function useConfirm() {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...opts, resolve })),
    []
  );

  const dialog = state ? (
    <ConfirmDialog
      {...state}
      onConfirm={() => {
        state.resolve(true);
        setState(null);
      }}
      onCancel={() => {
        state.resolve(false);
        setState(null);
      }}
    />
  ) : null;

  return { confirm, dialog };
}
