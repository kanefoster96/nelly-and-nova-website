"use client";

import { useState } from "react";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { useSession, signOut } from "@/lib/auth/session";
import { useRouter } from "next/navigation";

/**
 * Account holder information — the owner's own details and password. The dog is
 * the main profile; this is where the owner manages their own account.
 *
 * TODO(backend): load/save via Supabase (auth.users + a profiles row) and
 * supabase.auth.updateUser({ password }).
 */
export function AccountInfo() {
  const router = useRouter();
  const session = useSession();

  const [firstName, setFirstName] = useState("Rachel");
  const [lastName, setLastName] = useState("T.");
  const [email, setEmail] = useState("rachel@example.com");
  const [phone, setPhone] = useState("07123 456789");
  const [address, setAddress] = useState("14 Beach Rd, Whitley Bay, NE26");
  const [saved, setSaved] = useState(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");

  if (!session) {
    return (
      <div className="rounded-3xl bg-white/[0.04] p-8 text-center ring-1 ring-white/10">
        <h2 className="display-heading text-2xl text-paper">Please log in</h2>
        <div className="mt-6 flex justify-center">
          <Button href="/login" radius="xl">
            Log in
          </Button>
        </div>
      </div>
    );
  }

  function saveDetails() {
    // TODO(backend): update the profile row.
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  function changePassword() {
    setPwMsg("");
    setPwErr("");
    if (password.length < 8) {
      setPwErr("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setPwErr("Passwords don't match.");
      return;
    }
    // TODO(backend): supabase.auth.updateUser({ password }).
    setPassword("");
    setConfirm("");
    setPwMsg("Password updated.");
  }

  function logout() {
    signOut();
    router.push("/");
  }

  return (
    <div className="space-y-8">
      {/* Your details */}
      <div className="rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10 sm:p-8">
        <h2 className="display-heading text-xl text-paper">Your details</h2>
        <div className="mt-5 grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="First name" name="firstName" value={firstName} onChange={setFirstName} />
            <Field label="Last name" name="lastName" value={lastName} onChange={setLastName} />
          </div>
          <Field label="Email" name="email" type="email" inputMode="email" value={email} onChange={setEmail} />
          <Field label="Phone" name="phone" type="tel" inputMode="tel" value={phone} onChange={setPhone} />
          <Field label="Address & postcode" name="address" value={address} onChange={setAddress} />
          <div className="flex items-center gap-3">
            <Button radius="xl" onClick={saveDetails}>
              Save changes
            </Button>
            {saved && <span className="text-sm text-accent">Saved</span>}
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10 sm:p-8">
        <h2 className="display-heading text-xl text-paper">Change password</h2>
        <div className="mt-5 grid gap-5">
          <Field label="New password" name="newPassword" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" error={pwErr} />
          <Field label="Confirm new password" name="confirmPassword" type="password" value={confirm} onChange={setConfirm} />
          <div className="flex items-center gap-3">
            <Button radius="xl" variant="secondary" onClick={changePassword}>
              Update password
            </Button>
            {pwMsg && <span className="text-sm text-accent">{pwMsg}</span>}
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <Button variant="ghost" radius="xl" onClick={logout}>
          Log out
        </Button>
      </div>
    </div>
  );
}
