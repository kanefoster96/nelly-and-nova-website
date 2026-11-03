"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { AddressPin } from "@/components/maps/AddressPin";
import { saveProfile } from "@/lib/records/client";
import type { AccountProfile } from "@/lib/records/types";
import { AccountGate } from "./AccountGate";
import { accountCard, useAccount } from "./useAccount";

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

/** Edit account: your own contact details, saved on your `profiles` row. */
function DetailsForm() {
  const { profile, error: loadError } = useAccount();
  const [form, setForm] = useState<Form>(EMPTY);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!profile) return;
    // Fill the form once the profile row has loaded.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      ownerName: profile.ownerName,
      phone: profile.phone,
      address: profile.address,
      city: profile.city,
      postcode: profile.postcode,
      country: profile.country,
      emergencyContact1: profile.emergencyContact1,
      emergencyContact2: profile.emergencyContact2,
    });
  }, [profile]);

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

  const fullAddress = [form.address, form.city, form.postcode].filter((x) => x.trim()).join(", ");

  return (
    <div className={accountCard}>
      {loadError && <p className="mb-5 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{loadError}</p>}
      <div className="grid gap-5">
        <Field label="Full name" name="ownerName" required value={form.ownerName} onChange={set("ownerName")} />
        <div>
          <p className="mb-2 block text-sm text-paper-dim">Email</p>
          <p className="rounded-lg border border-white/10 bg-ink px-4 py-2.5 text-sm text-paper-dim">{profile?.email || "—"}</p>
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
  );
}

export function AccountDetailsForm() {
  return (
    <AccountGate>
      <DetailsForm />
    </AccountGate>
  );
}
