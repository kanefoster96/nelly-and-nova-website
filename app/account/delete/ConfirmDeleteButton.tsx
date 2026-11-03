"use client";

import { useFormStatus } from "react-dom";
import { deleteMyAccount } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-red-500 px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Delete my account"}
    </button>
  );
}

export function ConfirmDeleteButton() {
  return (
    <form
      action={deleteMyAccount}
      className="mt-8"
      onSubmit={(e) => {
        if (!window.confirm("Delete your account permanently? Your Direct Debit will be cancelled and your dogs' records removed. This can't be undone.")) e.preventDefault();
      }}
    >
      <SubmitButton />
    </form>
  );
}
