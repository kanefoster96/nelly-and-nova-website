"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { ArrowRightIcon } from "./ui/Icons";
import { useSession, useAuthStatus, signOut, updatePassword } from "@/lib/auth/session";
import { getMyDogs, getMyProfile, saveProfile } from "@/lib/records/client";
import type { AccountProfile, DogRecord } from "@/lib/records/types";
import { AddressPin } from "./maps/AddressPin";

type Form = Pick<
  AccountProfile,
  "ownerName" | "phone" | "address" | "city" | "postcode" | "country" | "emergencyContact1" | "emergencyContact2"
>;

const EMPTY: Form = {
  ownerName: "",
  phone: "",
  address: "",
  city: "",
  postcode: "",
  country: "",
  emergencyContact1: "",
  emergencyContact2: "",
};

const card = "rounded-2xl border border-white/10 bg-ink-soft p-6 sm:p-8";

/**
 * Account holder information: the owner's own contact details (saved on their
 * `profiles` row), quick links to each of their dogs, and their password.
 */
export function AccountInfo() {
  const router = useRouter();
  const session = useSession();
  const authStatus = useAuthStatus();

  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [dogs, setDogs] = useState<DogRecord[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [saveError, setSaveError] = useState("");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");

  const signedIn = !!session;
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    Promise.all([getMyProfile(), getMyDogs()])
      .then(([p, d]) => {
        if (cancelled) return;
        setProfile(p);
        setForm({
          ownerName: p.ownerName,
          phone: p.phone,
          address: p.address,
          city: p.city,
          postcode: p.postcode,
          country: p.country,
          emergencyContact1: p.emergencyContact1,
          emergencyContact2: p.emergencyContact2,
        });
        setDogs(d);
      })
      .catch((e: Error) => !cancelled && setLoadError(e.message));
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  if (authStatus === "loading") {
    return <div className={`${card} text-center text-paper-dim`}>Loading…</div>;
  }

  if (!session) {
    return (
      <div className={`${card} text-center`}>
        <h2 className="text-2xl font-semibold text-paper">Please log in</h2>
        <div className="mt-6 flex justify-center">
          <Button href="/login" radius="xl">Log in</Button>
        </div>
      </div>
    );
  }

  const set = (key: keyof Form) => (v: string) => {
    setForm((f) => ({ ...f, [key]: v }));
    setSaveState("idle");
  };

  async function saveDetails() {
    if (!profile) return;
    if (!form.ownerName.trim()) {
      setSaveError("Please enter your name.");
      return;
    }
    setSaveError("");
    setSaveState("saving");
    try {
      await saveProfile(profile.id, form);
      setSaveState("saved");
    } catch (e) {
      setSaveError((e as Error).message);
      setSaveState("idle");
    }
  }

  async function changePassword() {
    setPwMsg("");
    setPwErr("");
    if (password.length < 8) return setPwErr("Use at least 8 characters.");
    if (password !== confirm) return setPwErr("Passwords don't match.");
    const { error } = await updatePassword(password);
    if (error) return setPwErr(error);
    setPassword("");
    setConfirm("");
    setPwMsg("Password updated.");
  }

  function logout() {
    void signOut();
    router.push("/");
  }

  const fullAddress = [form.address, form.city, form.postcode].filter((x) => x.trim()).join(", ");

  return (
    <div className="space-y-6">
      {loadError && (
        <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{loadError}</p>
      )}

      {/* Your dogs — quick links to each dog's record */}
      <div className={card}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-paper">Your dogs</h2>
          <Link href="/profile/dogs/new" className="text-sm text-paper-dim underline underline-offset-2 hover:text-paper">
            + Add a dog
          </Link>
        </div>
        {dogs === null && !loadError ? (
          <p className="mt-4 text-sm text-paper-dim">Loading…</p>
        ) : dogs && dogs.length === 0 ? (
          <p className="mt-4 text-sm text-paper-dim">No dogs on your account yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
            {(dogs ?? []).map((d) => (
              <li key={d.id}>
                <Link href={`/profile/dogs/${d.id}`} className="flex items-center gap-3 bg-ink px-4 py-3 transition-colors hover:bg-white/[0.04]">
                  <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10">
                    {d.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.photoUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-paper">{d.name}</span>
                    <span className="block truncate text-xs text-paper-dim">
                      {[d.breed, d.waiverSignedAt ? "Consent form signed" : "Consent form needed"].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <ArrowRightIcon width={16} height={16} className="shrink-0 text-paper-dim" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Your details */}
      <div className={card}>
        <h2 className="text-lg font-semibold text-paper">Your details</h2>
        <div className="mt-5 grid gap-5">
          <Field label="Full name" name="ownerName" required value={form.ownerName} onChange={set("ownerName")} />
          <div>
            <p className="mb-2 block text-sm text-paper-dim">Email</p>
            <p className="rounded-lg border border-white/10 bg-ink px-4 py-2.5 text-sm text-paper-dim">
              {profile?.email || "—"}
            </p>
          </div>
          <Field label="Phone" name="phone" type="tel" inputMode="tel" value={form.phone} onChange={set("phone")} />
          <Field label="Address" name="address" value={form.address} onChange={set("address")} placeholder="Street address" />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Town / city" name="city" value={form.city} onChange={set("city")} />
            <Field label="Postcode" name="postcode" value={form.postcode} onChange={set("postcode")} />
          </div>
          {fullAddress && <AddressPin address={fullAddress} showMap={false} />}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Emergency contact 1" name="em1" type="tel" inputMode="tel" value={form.emergencyContact1} onChange={set("emergencyContact1")} placeholder="Name & number" />
            <Field label="Emergency contact 2" name="em2" type="tel" inputMode="tel" value={form.emergencyContact2} onChange={set("emergencyContact2")} placeholder="Name & number" />
          </div>
          {saveError && <p className="text-sm text-red-400">{saveError}</p>}
          <div className="flex items-center gap-3">
            <Button radius="xl" onClick={() => void saveDetails()} disabled={!profile || saveState === "saving"} className="disabled:opacity-60">
              {saveState === "saving" ? "Saving…" : "Save changes"}
            </Button>
            {saveState === "saved" && <span className="text-sm text-emerald-300">Saved ✓</span>}
          </div>
        </div>
      </div>

      {/* Password */}
      <div className={card}>
        <h2 className="text-lg font-semibold text-paper">Change password</h2>
        <div className="mt-5 grid gap-5">
          <Field label="New password" name="newPassword" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" error={pwErr} />
          <Field label="Confirm new password" name="confirmPassword" type="password" value={confirm} onChange={setConfirm} />
          <div className="flex items-center gap-3">
            <Button radius="xl" variant="secondary" onClick={() => void changePassword()}>
              Update password
            </Button>
            {pwMsg && <span className="text-sm text-emerald-300">{pwMsg}</span>}
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
