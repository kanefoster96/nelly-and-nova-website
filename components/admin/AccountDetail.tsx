"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ArrowRightIcon } from "@/components/ui/Icons";
import { createDog, getAccount, getAccountDogs, saveProfile } from "@/lib/records/client";
import { ageFromDob, type AccountProfile, type DogRecord } from "@/lib/records/types";

const card = "rounded-2xl border border-white/10 bg-ink-soft p-6 sm:p-8";

/** A customer account for the trainer: contact details (editable) and links to each dog. */
export function AccountDetail({ accountId }: { accountId: string }) {
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [dogs, setDogs] = useState<DogRecord[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [a, d] = await Promise.all([getAccount(accountId), getAccountDogs(accountId)]);
      if (!a) return setState("missing");
      setAccount(a);
      setDogs(d);
      setState("ready");
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  }, [accountId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (state === "loading") return <p className="mt-8 text-paper-dim">Loading…</p>;
  if (state === "error") return <p className="mt-8 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>;
  if (state === "missing" || !account) return <p className="mt-8 text-paper-dim">Account not found.</p>;

  return (
    <div className="mt-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-paper">{account.ownerName || "Unnamed account"}</h1>
        <p className="mt-1 text-sm text-paper-dim">
          {account.email && (
            <a href={`mailto:${account.email}`} className="underline underline-offset-2 hover:text-paper">
              {account.email}
            </a>
          )}
          {account.phone && (
            <>
              {" · "}
              <a href={`tel:${account.phone}`} className="underline underline-offset-2 hover:text-paper">
                {account.phone}
              </a>
            </>
          )}
        </p>
      </div>

      <DogsCard accountId={account.id} dogs={dogs} onAdded={(d) => setDogs((x) => [...x, d])} />
      <ContactCard account={account} onSaved={setAccount} />
    </div>
  );
}

function DogsCard({ accountId, dogs, onAdded }: { accountId: string; dogs: DogRecord[]; onAdded: (d: DogRecord) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function add() {
    if (!name.trim()) return setError("Enter the dog's name.");
    setError("");
    try {
      onAdded(await createDog({ name: name.trim() }, accountId));
      setName("");
      setAdding(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className={card}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-paper">Dogs</h2>
        <button type="button" onClick={() => setAdding((a) => !a)} className="text-sm text-paper-dim underline underline-offset-2 hover:text-paper">
          {adding ? "Cancel" : "+ Add a dog"}
        </button>
      </div>
      {adding && (
        <div className="mt-4 flex items-end gap-3">
          <div className="flex-1">
            <Field label="Dog's name" name="newDog" value={name} onChange={setName} error={error} />
          </div>
          <Button radius="xl" onClick={() => void add()}>Add</Button>
        </div>
      )}
      {dogs.length === 0 ? (
        <p className="mt-4 text-sm text-paper-dim">No dogs on this account yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
          {dogs.map((d) => (
            <li key={d.id}>
              <Link href={`/admin/dogs/${d.id}`} className="flex items-center gap-3 bg-ink px-4 py-3 transition-colors hover:bg-white/[0.04]">
                <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10">
                  {d.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.photoUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-paper">{d.name}</span>
                  <span className="block truncate text-xs text-paper-dim">{[d.breed, ageFromDob(d.dateOfBirth)].filter(Boolean).join(" · ") || "—"}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${d.waiverSignedAt ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>
                  {d.waiverSignedAt ? "Form signed" : "Form needed"}
                </span>
                <ArrowRightIcon width={16} height={16} className="shrink-0 text-paper-dim" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ContactCard({ account, onSaved }: { account: AccountProfile; onSaved: (a: AccountProfile) => void }) {
  const [f, setF] = useState(account);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  const set = (k: keyof AccountProfile) => (v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    setState("idle");
  };

  async function save() {
    setError("");
    setState("saving");
    try {
      await saveProfile(account.id, f);
      onSaved(f);
      setState("saved");
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
    }
  }

  return (
    <div className={card}>
      <h2 className="text-lg font-semibold text-paper">Contact details</h2>
      <div className="mt-5 grid gap-5">
        <Field label="Full name" name="ownerName" value={f.ownerName} onChange={set("ownerName")} />
        <Field label="Phone" name="phone" type="tel" value={f.phone} onChange={set("phone")} />
        <Field label="Address" name="address" value={f.address} onChange={set("address")} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Town / city" name="city" value={f.city} onChange={set("city")} />
          <Field label="Postcode" name="postcode" value={f.postcode} onChange={set("postcode")} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Emergency contact 1" name="em1" value={f.emergencyContact1} onChange={set("emergencyContact1")} />
          <Field label="Emergency contact 2" name="em2" value={f.emergencyContact2} onChange={set("emergencyContact2")} />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex items-center gap-3">
          <Button radius="xl" onClick={() => void save()} disabled={state === "saving"} className="disabled:opacity-60">
            {state === "saving" ? "Saving…" : "Save"}
          </Button>
          {state === "saved" && <span className="text-sm text-emerald-300">Saved ✓</span>}
        </div>
      </div>
    </div>
  );
}
