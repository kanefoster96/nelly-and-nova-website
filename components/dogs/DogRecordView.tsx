"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectCards } from "@/components/ui/SelectCards";
import { AvatarUpload } from "@/components/ui/AvatarUpload";
import { useAuthStatus, useSession } from "@/lib/auth/session";
import {
  deleteDocument,
  documentLink,
  getAccount,
  getDog,
  listDocuments,
  listWaivers,
  saveDog,
  uploadDocument,
  uploadDogPhoto,
} from "@/lib/records/client";
import {
  DOCUMENT_KINDS,
  ageFromDob,
  type AccountProfile,
  type DocumentKind,
  type DogDocument,
  type DogRecord,
  type WaiverRecord,
} from "@/lib/records/types";

const card = "rounded-2xl border border-white/10 bg-ink-soft p-6 sm:p-8";

const SEXES = [
  { value: "", label: "Select…" },
  { value: "Male", label: "Male" },
  { value: "Male (neutered)", label: "Male (neutered)" },
  { value: "Female", label: "Female" },
  { value: "Female (spayed)", label: "Female (spayed)" },
];

const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * One dog's full record: photo, details, health & vet, documents (vaccination
 * record etc., stored privately) and the signed consent & waiver.
 *
 * mode="owner"   the customer's own dog (/profile/dogs/[id])
 * mode="trainer" any dog, with a link to the owner's account (/admin/dogs/[id])
 */
export function DogRecordView({ dogId, mode }: { dogId: string; mode: "owner" | "trainer" }) {
  const session = useSession();
  const authStatus = useAuthStatus();
  const [dog, setDog] = useState<DogRecord | null>(null);
  const [owner, setOwner] = useState<AccountProfile | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await getDog(dogId);
      if (!d) return setState("missing");
      setDog(d);
      setState("ready");
      if (mode === "trainer") setOwner(await getAccount(d.accountId).catch(() => null));
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  }, [dogId, mode]);

  const signedIn = !!session;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (signedIn) void load();
  }, [signedIn, load]);

  if (authStatus === "loading" || (signedIn && state === "loading")) {
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
  if (state === "error") {
    return <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>;
  }
  if (state === "missing" || !dog) {
    return (
      <div className={`${card} text-center`}>
        <h2 className="text-xl font-semibold text-paper">Dog not found</h2>
        <p className="mt-2 text-sm text-paper-dim">It may have been removed, or it isn&apos;t on this account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header dog={dog} owner={owner} mode={mode} onPhoto={(url) => setDog({ ...dog, photoUrl: url })} />
      <DetailsCard dog={dog} onSaved={(d) => setDog(d)} />
      <DocumentsCard dog={dog} />
      <WaiverCard dog={dog} mode={mode} />
    </div>
  );
}

function Header({
  dog,
  owner,
  mode,
  onPhoto,
}: {
  dog: DogRecord;
  owner: AccountProfile | null;
  mode: "owner" | "trainer";
  onPhoto: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const age = ageFromDob(dog.dateOfBirth);

  async function pick(dataUrl: string) {
    setUploading(true);
    setError("");
    try {
      onPhoto(await uploadDogPhoto(dog, dataUrl));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-5">
      <div className="relative">
        <AvatarUpload value={dog.photoUrl} onSelect={(u) => void pick(u)} size={88} label="Photo" />
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-xs text-paper">Saving…</span>
        )}
      </div>
      <div className="min-w-0">
        <h1 className="truncate text-3xl font-semibold tracking-tight text-paper">{dog.name}</h1>
        <p className="mt-1 text-sm text-paper-dim">{[dog.breed, age, dog.sex].filter(Boolean).join(" · ") || "Add their details below"}</p>
        {mode === "trainer" && owner && (
          <p className="mt-2 text-sm">
            <span className="text-paper-dim">Owner: </span>
            <Link href={`/admin/members/${owner.id}`} className="text-paper underline underline-offset-2 hover:text-accent">
              {owner.ownerName || owner.email}
            </Link>
            {owner.phone && (
              <a href={`tel:${owner.phone}`} className="ml-2 text-paper-dim underline underline-offset-2 hover:text-paper">
                {owner.phone}
              </a>
            )}
          </p>
        )}
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}

function DetailsCard({ dog, onSaved }: { dog: DogRecord; onSaved: (d: DogRecord) => void }) {
  const [f, setF] = useState(dog);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");

  const set = <K extends keyof DogRecord>(k: K) => (v: DogRecord[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setState("idle");
  };

  async function save() {
    if (!f.name.trim()) return setError("Your dog needs a name.");
    if (f.dateOfBirth && f.dateOfBirth > new Date().toISOString().slice(0, 10)) {
      return setError("Date of birth can't be in the future.");
    }
    setError("");
    setState("saving");
    try {
      const { id: _id, accountId: _a, createdAt: _c, waiverSignedAt: _w, ...patch } = f;
      void _id; void _a; void _c; void _w;
      await saveDog(dog.id, patch);
      onSaved(f);
      setState("saved");
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
    }
  }

  return (
    <div className={card}>
      <h2 className="text-lg font-semibold text-paper">Details</h2>
      <div className="mt-5 grid gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" name="name" required value={f.name} onChange={set("name")} />
          <Field label="Breed" name="breed" value={f.breed} onChange={set("breed")} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Sex" name="sex" value={f.sex} onChange={set("sex")} options={SEXES} />
          <Field label="Date of birth" name="dob" type="date" value={f.dateOfBirth} onChange={set("dateOfBirth")} />
        </div>
        <Field label="Microchip number" name="microchip" value={f.microchip} onChange={set("microchip")} />

        <h3 className="mt-2 text-sm font-semibold uppercase tracking-wider text-paper-dim">Health</h3>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-ink p-4">
          <input
            type="checkbox"
            checked={f.vaccinationsConfirmed}
            onChange={(e) => set("vaccinationsConfirmed")(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
          />
          <span className="text-sm text-paper/85">Vaccinations are up to date</span>
        </label>
        <div>
          <p className="mb-2 block text-sm text-paper-dim">Kennel cough vaccination?</p>
          <SelectCards
            ariaLabel="Kennel cough vaccination"
            options={YES_NO}
            value={f.kennelCough === null ? "" : f.kennelCough ? "yes" : "no"}
            onChange={(v) => set("kennelCough")(v === "yes")}
          />
        </div>
        <Field label="Medical conditions" name="medical" textarea rows={2} value={f.medicalConditions} onChange={set("medicalConditions")} placeholder="None" />
        <Field label="Allergies" name="allergies" textarea rows={2} value={f.allergies} onChange={set("allergies")} placeholder="None" />

        <h3 className="mt-2 text-sm font-semibold uppercase tracking-wider text-paper-dim">Vet</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Vet's name / practice" name="vetName" value={f.vetName} onChange={set("vetName")} />
          <Field label="Vet's phone" name="vetPhone" type="tel" inputMode="tel" value={f.vetPhone} onChange={set("vetPhone")} />
        </div>
        <Field label="Vet's address" name="vetAddress" value={f.vetAddress} onChange={set("vetAddress")} />

        <Field label="Anything else we should know?" name="notes" textarea rows={3} value={f.notes} onChange={set("notes")} />

        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex items-center gap-3">
          <Button radius="xl" onClick={() => void save()} disabled={state === "saving"} className="disabled:opacity-60">
            {state === "saving" ? "Saving…" : "Save details"}
          </Button>
          {state === "saved" && <span className="text-sm text-emerald-300">Saved ✓</span>}
        </div>
      </div>
    </div>
  );
}

function DocumentsCard({ dog }: { dog: DogRecord }) {
  const [docs, setDocs] = useState<DogDocument[] | null>(null);
  const [kind, setKind] = useState<DocumentKind>("vaccination");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setDocs(await listDocuments({ dogId: dog.id }));
    } catch (e) {
      setError((e as Error).message);
      setDocs([]);
    }
  }, [dog.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      await uploadDocument(file, { kind, dogId: dog.id, accountId: dog.accountId });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function open(doc: DogDocument) {
    // Open the tab first (synchronously) so pop-up blockers allow it.
    const tab = window.open("", "_blank");
    try {
      const url = await documentLink(doc.path);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (e) {
      tab?.close();
      setError((e as Error).message);
    }
  }

  async function remove(doc: DogDocument) {
    if (!window.confirm(`Delete “${doc.fileName}”?`)) return;
    try {
      await deleteDocument(doc);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const label = (k: DocumentKind) => (k === "waiver" ? "Signed waiver" : DOCUMENT_KINDS.find((x) => x.value === k)?.label ?? "Document");

  return (
    <div className={card}>
      <h2 className="text-lg font-semibold text-paper">Documents</h2>
      <p className="mt-1 text-sm text-paper-dim">Vaccination records, insurance and vet letters — kept privately on your account.</p>

      {docs === null ? (
        <p className="mt-4 text-sm text-paper-dim">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="mt-4 text-sm text-paper-dim">No documents yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 bg-ink px-4 py-3">
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => void open(d)} className="block max-w-full truncate text-left text-sm font-medium text-paper underline-offset-2 hover:underline">
                  {d.fileName}
                </button>
                <p className="text-xs text-paper-dim">
                  {label(d.kind)} · {formatDate(d.createdAt)}
                </p>
              </div>
              <button type="button" onClick={() => void remove(d)} className="text-xs text-paper-dim underline underline-offset-2 hover:text-red-300">
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field
          label="Add a document"
          name="docKind"
          value={kind}
          onChange={(v) => setKind(v as DocumentKind)}
          options={DOCUMENT_KINDS.map((k) => ({ value: k.value, label: k.label }))}
        />
        <Button radius="xl" variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy} className="disabled:opacity-60">
          {busy ? "Uploading…" : "Choose file"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
      </div>
      <p className="mt-2 text-xs text-paper-dim">Photos or PDFs, up to 10 MB.</p>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}

function WaiverCard({ dog, mode }: { dog: DogRecord; mode: "owner" | "trainer" }) {
  const [waivers, setWaivers] = useState<WaiverRecord[] | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listWaivers({ dogId: dog.id })
      .then(async (list) => {
        if (cancelled) return;
        setWaivers(list);
        const latest = list[0];
        if (latest?.signaturePath) {
          const url = await documentLink(latest.signaturePath, 600).catch(() => null);
          if (!cancelled) setSignature(url);
        }
      })
      .catch(() => !cancelled && setWaivers([]));
    return () => {
      cancelled = true;
    };
  }, [dog.id]);

  const latest = waivers?.[0];

  return (
    <div className={card}>
      <h2 className="text-lg font-semibold text-paper">Consent &amp; waiver</h2>
      {waivers === null ? (
        <p className="mt-4 text-sm text-paper-dim">Loading…</p>
      ) : latest ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-emerald-300">
            Signed by {latest.signedName} on {formatDate(latest.signedAt)} ✓
          </p>
          {signature && (
            <div className="rounded-lg border border-white/10 bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={signature} alt={`Signature of ${latest.signedName}`} className="mx-auto h-20 object-contain" />
            </div>
          )}
          {mode === "trainer" && <WaiverAnswers answers={latest.answers} />}
          {mode === "owner" && (
            <Link href={`/waiver?dog=${dog.id}`} className="inline-block text-sm text-paper-dim underline underline-offset-2 hover:text-paper">
              Sign an updated form
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-paper-dim">Not signed yet — this is needed before {dog.name}&apos;s first session.</p>
          {mode === "owner" && (
            <div className="mt-4">
              <Button href={`/waiver?dog=${dog.id}`} radius="xl">
                Complete the consent form
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The answers given on the signed form, for the trainer. */
function WaiverAnswers({ answers }: { answers: Record<string, unknown> }) {
  const rows: [string, unknown][] = [
    ["Emergency contact 1", answers.emergencyContact1],
    ["Emergency contact 2", answers.emergencyContact2],
    ["Microchip", answers.microchip],
    ["Vaccinations up to date", answers.vaccConfirmed ? "Yes" : "No"],
    ["Kennel cough", answers.kennelCough],
    ["Medical conditions", answers.medical === "yes" ? answers.medicalDetails : "None"],
    ["Allergies", answers.allergies === "yes" ? answers.allergyDetails : "None"],
    ["Vet", [answers.vetName, answers.vetPhone, answers.vetAddress].filter(Boolean).join(" · ")],
  ];
  return (
    <dl className="grid gap-x-4 gap-y-2 rounded-lg border border-white/10 bg-ink p-4 text-sm sm:grid-cols-[auto_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-paper-dim">{k}</dt>
          <dd className="text-paper">{String(v ?? "") || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
