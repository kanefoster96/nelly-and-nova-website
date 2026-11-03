"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { updatePassword } from "@/lib/auth/session";
import { AccountGate } from "./AccountGate";
import { accountCard } from "./useAccount";

/** Change password, on its own page as in Kanvas's account. */
export function PasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  async function changePassword() {
    setMsg("");
    setErr("");
    if (password.length < 8) return setErr("Use at least 8 characters.");
    if (password !== confirm) return setErr("Passwords don't match.");
    setSaving(true);
    const { error } = await updatePassword(password);
    setSaving(false);
    if (error) return setErr(error);
    setPassword("");
    setConfirm("");
    setMsg("Password updated.");
  }

  return (
    <AccountGate>
      <div className={accountCard}>
        <div className="grid gap-5">
          <Field label="New password" name="newPassword" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" error={err} />
          <Field label="Confirm new password" name="confirmPassword" type="password" value={confirm} onChange={setConfirm} />
          <div className="flex items-center gap-3">
            <Button radius="xl" onClick={() => void changePassword()} disabled={saving} className="disabled:opacity-60">
              {saving ? "Updating…" : "Update password"}
            </Button>
            {msg && <span className="text-sm text-emerald-300">{msg}</span>}
          </div>
        </div>
      </div>
    </AccountGate>
  );
}
