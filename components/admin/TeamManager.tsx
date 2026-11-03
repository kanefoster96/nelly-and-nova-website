"use client";

import { useCallback, useEffect, useState } from "react";
import { AvatarUpload } from "@/components/ui/AvatarUpload";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

type Trainer = { id: string; owner_name: string | null; email: string | null; avatar_url: string | null };

const sb = () => createClient();

/** A data URL from AvatarUpload → a file in the public `media` bucket, under the signed-in trainer's folder. */
async function uploadPhoto(dataUrl: string, forId: string): Promise<string> {
  const {
    data: { user },
  } = await sb().auth.getUser();
  if (!user) throw new Error("Please log in again.");
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${user.id}/team-${forId}-${Date.now()}.jpg`;
  const { error } = await sb().storage.from("media").upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: true });
  if (error) throw new Error("Couldn't upload that photo.");
  return sb().storage.from("media").getPublicUrl(path).data.publicUrl;
}

/**
 * The team (like Kanvas Academy's Roles and coach profiles): every trainer's
 * display name and photo — shown on their chat messages, community posts
 * (with the official tick) and around the app — editable by any trainer,
 * plus adding someone as a trainer by email, or removing them.
 */
export function TeamManager() {
  const [team, setTeam] = useState<Trainer[] | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const [{ data, error: e }, { data: auth }] = await Promise.all([
      sb().from("profiles").select("id, owner_name, email, avatar_url").eq("role", "admin").order("owner_name"),
      sb().auth.getUser(),
    ]);
    if (e) setError("Couldn't load the team.");
    setTeam((data as Trainer[]) ?? []);
    setMe(auth.user?.id ?? null);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function addTrainer() {
    const email = addEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter their email address.");
    setAdding(true);
    setError("");
    setNote("");
    const { data: found } = await sb().from("profiles").select("id, role").ilike("email", email).maybeSingle();
    if (!found) {
      setAdding(false);
      return setError("There's no account with that email yet. Ask them to create one (website or app) with this email, then add them here.");
    }
    if (found.role === "admin") {
      setAdding(false);
      return setNote("They're already on the team.");
    }
    const { error: e } = await sb().from("profiles").update({ role: "admin" }).eq("id", found.id);
    setAdding(false);
    if (e) return setError("Couldn't add them.");
    setAddEmail("");
    setNote("Added to the team. Give them a display name below.");
    await load();
  }

  async function remove(t: Trainer) {
    if (!window.confirm(`Remove ${t.owner_name || t.email} from the team? They'll keep their account as an owner.`)) return;
    const { error: e } = await sb().from("profiles").update({ role: "member" }).eq("id", t.id);
    if (e) return setError("Couldn't remove them.");
    await load();
  }

  return (
    <div className="mt-8 grid gap-4">
      {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      {note && <p className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">{note}</p>}

      {team === null ? (
        <p className="text-paper-dim">Loading…</p>
      ) : (
        team.map((t) => <TrainerCard key={t.id} trainer={t} isMe={t.id === me} onRemove={() => void remove(t)} onSaved={load} />)
      )}

      <div className="rounded-2xl border border-white/10 bg-ink-soft p-5">
        <p className="font-semibold text-paper">Add a trainer</p>
        <p className="mt-1 text-sm text-paper-dim">They need an account first (made on the website or in the app with this email).</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            type="email"
            placeholder="their@email.com"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-ink px-4 py-2.5 text-sm text-paper outline-none focus:border-white/40"
          />
          <Button radius="xl" onClick={() => void addTrainer()} disabled={adding} className="disabled:opacity-60">
            {adding ? "Adding…" : "Add to team"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TrainerCard({ trainer: t, isMe, onRemove, onSaved }: { trainer: Trainer; isMe: boolean; onRemove: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(t.owner_name ?? "");
  const [photo, setPhoto] = useState<string | null>(t.avatar_url);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save(nextPhoto?: string) {
    setBusy(true);
    setMsg("");
    try {
      const avatar_url = nextPhoto ? await uploadPhoto(nextPhoto, t.id) : undefined;
      const { error } = await sb()
        .from("profiles")
        .update({ owner_name: name.trim() || null, ...(avatar_url ? { avatar_url } : {}) })
        .eq("id", t.id);
      if (error) throw new Error("Couldn't save.");
      if (avatar_url) setPhoto(avatar_url);
      setMsg("Saved");
      await onSaved();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-ink-soft p-5">
      <AvatarUpload
        value={photo}
        onSelect={(dataUrl) => {
          setPhoto(dataUrl);
          void save(dataUrl);
        }}
        size={72}
        label="Photo"
      />
      <div className="min-w-0 flex-1">
        <label className="text-xs text-paper-dim" htmlFor={`name-${t.id}`}>
          Display name {isMe && "(you)"}
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id={`name-${t.id}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Charlotte (Trainer)"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-ink px-4 py-2.5 text-sm text-paper outline-none focus:border-white/40"
          />
          <Button radius="xl" variant="secondary" onClick={() => void save()} disabled={busy} className="disabled:opacity-60">
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
        <p className="mt-1 truncate text-xs text-paper-dim">
          {t.email}
          {msg && <span className="ml-2 text-emerald-300">{msg}</span>}
        </p>
      </div>
      {!isMe && (
        <button type="button" onClick={onRemove} className="text-sm text-paper-dim underline underline-offset-2 hover:text-red-300">
          Remove
        </button>
      )}
    </div>
  );
}
