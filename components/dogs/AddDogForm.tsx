"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useAuthStatus, useSession } from "@/lib/auth/session";
import { createDog } from "@/lib/records/client";

/** Add another dog to the signed-in account, then open its record to fill in. */
export function AddDogForm() {
  const router = useRouter();
  const session = useSession();
  const authStatus = useAuthStatus();
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (authStatus === "loading") return <p className="text-paper-dim">Loading…</p>;
  if (!session) {
    return (
      <div className="flex justify-center">
        <Button href="/login" radius="xl">Log in</Button>
      </div>
    );
  }

  async function add() {
    if (!name.trim()) return setError("What's your dog called?");
    setError("");
    setBusy(true);
    try {
      const dog = await createDog({ name: name.trim(), breed });
      router.push(`/profile/dogs/${dog.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form
      className="grid gap-5 rounded-2xl border border-white/10 bg-ink-soft p-6 sm:p-8"
      onSubmit={(e) => {
        e.preventDefault();
        void add();
      }}
    >
      <Field label="Dog's name" name="name" required value={name} onChange={setName} error={error} />
      <Field label="Breed" name="breed" value={breed} onChange={setBreed} />
      <Button type="submit" radius="xl" disabled={busy} className="disabled:opacity-60">
        {busy ? "Adding…" : "Add dog"}
      </Button>
      <p className="text-center text-xs text-paper-dim">You can add their photo, health details and documents next.</p>
    </form>
  );
}
