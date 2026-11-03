"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth/session";
import { listAllDogs, type DogWithOwner } from "@/lib/records/client";
import { useReports, byDateDesc, publishCards, deleteCard } from "@/lib/reports/client";
import { saveReportEntry, isComplete } from "@/lib/reports/entry";
import { daysFor, HOMEWORK_TARGET_DAYS } from "@/lib/reports/progress";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ReportEntryModal, blankEntryForm, type EntryForm } from "./ReportEntryModal";
import { CARD, ERROR_BANNER, INPUT, OK_BANNER, PILL, PRIMARY, QUIET, shortDate, longDate } from "./styles";
import type { ReportCard } from "@/lib/reports/types";

type Writing = { dog: { id: string; name: string; photo: string | null }; date: string; form: EntryForm; cardId?: string };

function formFromCard(card: ReportCard): EntryForm {
  const wins = [...card.wins];
  while (wins.length < 3) wins.push("");
  return {
    summary: card.summary,
    wins,
    strength: card.strength ?? "",
    toImprove: card.toImprove ?? "",
    homework: card.homework.length
      ? card.homework.map((c) => ({ name: c.name, drills: c.drills.map((d) => ({ name: d.name, ref: d.ref ?? null, pillar: d.pillar ?? null })) }))
      : blankEntryForm().homework,
  };
}

/**
 * Report cards for trainers (Kanvas's queue layout): write a card for any
 * dog, the drafts waiting to go (edit, send, delete), and what's been sent
 * lately with how the homework's going. Sending publishes the card and the
 * owner gets an email and an app notification.
 */
export function AdminReportCards({ todayISO }: { todayISO: string }) {
  const session = useSession();
  const { cards, progress, loaded, error } = useReports();
  const [dogs, setDogs] = useState<DogWithOwner[] | null>(null);
  const [dogsError, setDogsError] = useState<string | null>(null);
  const [pickDog, setPickDog] = useState("");
  const [pickDate, setPickDate] = useState(todayISO);
  const [writing, setWriting] = useState<Writing | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    listAllDogs()
      .then(setDogs)
      .catch((err: unknown) => setDogsError(err instanceof Error ? err.message : "Couldn't load the dogs."));
  }, []);

  const drafts = useMemo(() => cards.filter((c) => c.status === "draft").sort(byDateDesc), [cards]);
  const sent = useMemo(() => cards.filter((c) => c.status !== "draft").sort(byDateDesc).slice(0, 40), [cards]);

  function startNew() {
    const dog = dogs?.find((d) => d.id === pickDog);
    if (!dog) return;
    // Carry on with that dog's draft for the day if there is one.
    const existing = drafts.find((c) => c.dogId === dog.id && c.date.slice(0, 10) === pickDate);
    setProblem(null);
    setWriting({
      dog: { id: dog.id, name: dog.name, photo: dog.photoUrl },
      date: pickDate,
      form: existing ? formFromCard(existing) : blankEntryForm(),
      cardId: existing?.id,
    });
  }

  function edit(card: ReportCard) {
    setProblem(null);
    setWriting({
      dog: { id: card.dogId ?? "", name: card.dogName ?? "Dog", photo: card.dogPhoto ?? null },
      date: card.date.slice(0, 10),
      form: formFromCard(card),
      cardId: card.id,
    });
  }

  async function save(send: boolean) {
    if (!writing) return;
    setBusy(true);
    setProblem(null);
    try {
      const id = await saveReportEntry(
        { dogId: writing.dog.id, coach: session?.ownerName ?? "Trainer", date: writing.date, ...writing.form, status: send ? "ready" : "draft" },
        writing.cardId
      );
      if (send) {
        const res = await publishCards([id]);
        setDone(
          res.notified > 0
            ? `Sent. ${writing.dog.name}'s owner has been emailed and notified.`
            : `Sent. ${writing.dog.name}'s owner will see it next time they open the app or website.`
        );
      } else {
        setDone(`Saved ${writing.dog.name}'s draft. Owners can't see drafts.`);
      }
      setWriting(null);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Couldn't save the report card.");
    } finally {
      setBusy(false);
    }
  }

  async function send(card: ReportCard) {
    const ok = await confirm({
      title: `Send ${card.dogName ?? "this dog"}'s report card?`,
      message: <>Their owner gets an email and an app notification, and can start on the homework.</>,
      confirmLabel: "Send",
    });
    if (!ok) return;
    try {
      await publishCards([card.id]);
      setDone(card.dogName ? `Sent ${card.dogName}'s report card.` : "Sent.");
    } catch (err) {
      setDone(null);
      setProblem(err instanceof Error ? err.message : "Couldn't send it.");
    }
  }

  async function remove(card: ReportCard) {
    const ok = await confirm({
      title: card.status === "draft" ? "Delete this draft?" : "Delete this report card?",
      message: card.status === "draft" ? <>It hasn&apos;t been sent, so the owner won&apos;t notice.</> : <>The owner will no longer see it, or its homework.</>,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await deleteCard(card.id);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Couldn't delete it.");
    }
  }

  async function sendAllDrafts() {
    const ready = drafts.filter((c) => c.summary.trim() && c.homework.length > 0);
    if (ready.length === 0) return;
    const ok = await confirm({
      title: `Send ${ready.length} report card${ready.length === 1 ? "" : "s"}?`,
      message: <>Every draft with a summary and homework goes to its owner, with an email and an app notification.</>,
      confirmLabel: "Send all",
    });
    if (!ok) return;
    try {
      const res = await publishCards(ready.map((c) => c.id));
      setDone(`Sent ${res.published} report card${res.published === 1 ? "" : "s"}.`);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Couldn't send them.");
    }
  }

  return (
    <div className="mt-8">
      {done && <p className={`mb-6 ${OK_BANNER}`}>{done}</p>}
      {(error || (problem && !writing)) && <p className={`mb-6 ${ERROR_BANNER}`}>{problem ?? error}</p>}

      {/* Write a card */}
      <section className={`${CARD} p-5`}>
        <h2 className="font-semibold text-paper">Write a report card</h2>
        <p className="mt-1 text-sm text-paper-dim">Pick the dog and the session. Homework comes from the drill library, or type your own.</p>
        {dogsError ? (
          <p className="mt-3 text-sm text-red-300">{dogsError}</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <select value={pickDog} onChange={(e) => setPickDog(e.target.value)} className={INPUT} aria-label="Dog">
              <option value="">{dogs ? "Choose a dog…" : "Loading dogs…"}</option>
              {(dogs ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.owner?.ownerName ? ` (${d.owner.ownerName})` : ""}
                </option>
              ))}
            </select>
            <input type="date" value={pickDate} max={todayISO} onChange={(e) => setPickDate(e.target.value)} className={`${INPUT} sm:w-44`} aria-label="Session date" />
            <button type="button" onClick={startNew} disabled={!pickDog} className={`${PRIMARY} shrink-0`}>
              Write
            </button>
          </div>
        )}
      </section>

      {/* Drafts */}
      <div className="mt-10 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-paper">Drafts</h2>
        {drafts.length > 1 && (
          <button type="button" onClick={sendAllDrafts} className={QUIET}>
            Send all
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {!loaded ? (
          <div className={`${CARD} h-24 animate-pulse`} />
        ) : drafts.length === 0 ? (
          <p className={`${CARD} px-6 py-8 text-center text-sm text-paper-dim`}>No drafts. Cards you save without sending wait here.</p>
        ) : (
          drafts.map((c) => {
            const ready = isComplete({ dogId: c.dogId ?? "", coach: "", date: c.date, ...formFromCard(c) });
            return (
              <div key={c.id} className={`${CARD} p-5`}>
                <div className="flex items-center gap-3">
                  <Avatar src={c.dogPhoto} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-paper">{c.dogName}</p>
                    <p className="truncate text-xs text-paper-dim">
                      {shortDate(c.date)} · {c.focus}
                    </p>
                  </div>
                  <span className={`${PILL} ${ready ? "bg-accent/15 text-accent" : "bg-amber-400/15 text-amber-300"}`}>{ready ? "Ready" : "Draft"}</span>
                </div>
                {c.summary && <p className="mt-3 line-clamp-2 text-sm text-paper/80">{c.summary}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => send(c)} disabled={!ready} className={PRIMARY} title={ready ? undefined : "Add a summary, a win and some homework first"}>
                    Send to owner
                  </button>
                  <button type="button" onClick={() => edit(c)} className={QUIET}>
                    Edit
                  </button>
                  <button type="button" onClick={() => remove(c)} className="rounded-full px-3 py-1.5 text-xs font-medium text-paper-dim hover:text-paper">
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sent */}
      <h2 className="mt-12 text-lg font-semibold text-paper">Recently sent</h2>
      {loaded && sent.length === 0 ? (
        <p className={`${CARD} mt-3 px-6 py-8 text-center text-sm text-paper-dim`}>Nothing sent yet.</p>
      ) : (
        <ul className={`${CARD} mt-3 divide-y divide-white/10`}>
          {sent.map((c) => {
            const days = daysFor(progress, c.id).length;
            return (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar src={c.dogPhoto} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-paper">
                    {c.dogName}
                    <span className="text-paper-dim"> · {c.focus}</span>
                  </p>
                  <p className="truncate text-xs text-paper-dim">
                    {longDate(c.date)} · practised {Math.min(days, HOMEWORK_TARGET_DAYS)} of {HOMEWORK_TARGET_DAYS} days
                    {c.comments.length > 0 && ` · ${c.comments.length} message${c.comments.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                <span className={`${PILL} ${days >= HOMEWORK_TARGET_DAYS ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-paper-dim"}`}>
                  {days >= HOMEWORK_TARGET_DAYS ? "Done" : `${days}/${HOMEWORK_TARGET_DAYS}`}
                </span>
                <Link href="/profile/reports" className="shrink-0 text-xs text-paper-dim underline underline-offset-2 hover:text-paper">
                  Open
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {writing && (
        <ReportEntryModal
          dog={writing.dog}
          coach={session?.ownerName ?? "Trainer"}
          dateLabel={longDate(writing.date)}
          form={writing.form}
          onChange={(p) => setWriting((w) => (w ? { ...w, form: { ...w.form, ...p } } : w))}
          onSaveDraft={() => save(false)}
          onMarkReady={() => save(true)}
          onClose={() => {
            setProblem(null);
            setWriting(null);
          }}
          busy={busy}
          problem={problem}
          readyLabel="Send to owner"
        />
      )}
      {dialog}
    </div>
  );
}

function Avatar({ src }: { src?: string | null }) {
  return (
    <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10">
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      )}
    </span>
  );
}
