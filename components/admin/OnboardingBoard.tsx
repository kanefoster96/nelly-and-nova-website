"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { getOnboardingProgress, listEnquiries, updateEnquiry, type OnboardingProgress } from "@/lib/records/client";
import { ENQUIRY_STATUSES, type Enquiry, type EnquiryStatus } from "@/lib/records/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function when(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${time}`;
}

function longWhen(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Value for <input type=datetime-local> in local time. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * The trainer's onboarding list: every contact-form message and meet & greet
 * request, grouped by where they are. A meet & greet can be booked from
 * either kind — plenty of people just use the contact form.
 */
export function OnboardingBoard() {
  const [items, setItems] = useState<Enquiry[] | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<EnquiryStatus>("new");
  const [progress, setProgress] = useState<Record<string, OnboardingProgress>>({});

  const load = useCallback(async () => {
    try {
      const list = await listEnquiries();
      setItems(list);
      setError("");
      // Direct Debit / account / dogs for everyone in onboarding.
      getOnboardingProgress(list.filter((e) => e.status === "onboarding"))
        .then(setProgress)
        .catch(() => {});
    } catch (e) {
      setError((e as Error).message);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of items ?? []) c[e.status] = (c[e.status] ?? 0) + 1;
    return c;
  }, [items]);

  const visible = (items ?? []).filter((e) => e.status === tab);

  function patchLocal(id: string, patch: Partial<Enquiry>) {
    setItems((list) => list?.map((e) => (e.id === id ? { ...e, ...patch } : e)) ?? null);
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-2">
        {ENQUIRY_STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setTab(s.value)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              tab === s.value ? "border-accent bg-accent text-accent-ink" : "border-white/15 text-paper-dim hover:border-white/35"
            }`}
          >
            {s.label} {counts[s.value] ? `(${counts[s.value]})` : ""}
          </button>
        ))}
      </div>

      {error && <p className="mt-6 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>}

      {items === null ? (
        <p className="mt-6 text-paper-dim">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="mt-6 text-sm text-paper-dim">
          {tab === "new" ? "No new enquiries. Contact-form messages and meet & greet requests appear here." : "Nothing here."}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {visible.map((e) => (
            <EnquiryCard key={e.id} enquiry={e} progress={progress[e.id]} onChange={(p) => patchLocal(e.id, p)} onReload={() => void load()} />
          ))}
        </ul>
      )}
    </div>
  );
}

const DD_LABEL: Record<string, string> = {
  none: "Not started",
  link_sent: "Link sent — waiting for them",
  pending_submission: "Set up — bank confirming",
  submitted: "Set up — bank confirming",
  active: "Active",
  failed: "Failed",
  cancelled: "Cancelled",
  expired: "Expired",
};

function Tick({ done, label, detail }: { done: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          done ? "bg-emerald-400 text-ink" : "bg-white/10 text-paper-dim"
        }`}
      >
        {done ? "✓" : ""}
      </span>
      <span className="min-w-0">
        <span className="font-medium text-paper">{label}</span>
        <span className="block text-paper-dim">{detail}</span>
      </span>
    </li>
  );
}

function EnquiryCard({
  enquiry: e,
  progress,
  onChange,
  onReload,
}: {
  enquiry: Enquiry;
  progress?: OnboardingProgress;
  onChange: (p: Partial<Enquiry>) => void;
  onReload: () => void;
}) {
  const [booking, setBooking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [settingDay, setSettingDay] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function move(status: EnquiryStatus) {
    setError("");
    try {
      await updateEnquiry(e.id, { status });
      onChange({ status });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  /**
   * After the meet & greet, when you're going ahead: creates their join link
   * and Direct Debit set-up, and emails it (and messages it, if they have an
   * account). Pressing it again re-sends the same link.
   */
  async function startOnboarding(resend = false) {
    const first = e.name.split(" ")[0];
    if (!resend && !window.confirm(`Start onboarding ${first}? They'll be emailed a link to set up their Direct Debit and register ${e.dogNames || "their dog"}.`)) return;
    setStarting(true);
    setError("");
    setNote("");
    try {
      const res = await fetch("/api/onboarding/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enquiryId: e.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Couldn't start onboarding.");
      const how = [json.emailed && "emailed", json.messaged && "messaged in their chat"].filter(Boolean).join(" and ");
      setNote(
        how
          ? `${resend ? "Link re-sent" : "Onboarding started"} — ${first} has been ${how}.`
          : `${resend ? "Link ready" : "Onboarding started"}. The email didn't go (email isn't fully set up yet) — copy the link below and send it to ${first}.`
      );
      onChange({ status: "onboarding" });
      onReload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStarting(false);
    }
  }

  async function copyJoinLink() {
    if (!e.onboardingToken) return;
    const link = `${window.location.origin}/join/${e.onboardingToken}`;
    try {
      await navigator.clipboard.writeText(link);
      setNote("Join link copied — paste it into a message to them.");
    } catch {
      setNote(link);
    }
  }

  async function notAFit() {
    const reason = window.prompt(`Close ${e.name.split(" ")[0]}'s request? Add a note for yourself (optional):`, "Not a fit");
    if (reason === null) return;
    setError("");
    try {
      await updateEnquiry(e.id, { status: "closed", closedReason: reason.trim() || null });
      onChange({ status: "closed" });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const details = Object.entries(e.details ?? {}).filter(
    ([k, v]) => v !== null && v !== "" && !["extraDogs", "company"].includes(k) && typeof v !== "object"
  );

  return (
    <li className="rounded-2xl border border-white/10 bg-ink-soft p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-paper">{e.name}</p>
            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-paper-dim">
              {e.kind === "booking" ? "Meet & greet form" : "Contact form"}
            </span>
          </div>
          <p className="mt-1 text-sm text-paper-dim">
            <a href={`mailto:${e.email}`} className="underline underline-offset-2 hover:text-paper">{e.email}</a>
            {e.phone && (
              <>
                {" · "}
                <a href={`tel:${e.phone}`} className="underline underline-offset-2 hover:text-paper">{e.phone}</a>
              </>
            )}
          </p>
        </div>
        <p className="text-xs text-paper-dim">{when(e.createdAt)}</p>
      </div>

      {(e.service || e.dogNames) && (
        <p className="mt-3 text-sm text-paper">{[e.service, e.dogNames && `Dogs: ${e.dogNames}`].filter(Boolean).join(" · ")}</p>
      )}
      {e.message && <p className="mt-2 whitespace-pre-line text-sm text-paper/80">{e.message}</p>}

      {e.kind === "booking" && details.length > 0 && (
        <div className="mt-3">
          <button type="button" onClick={() => setShowDetails((s) => !s)} className="text-xs text-paper-dim underline underline-offset-2 hover:text-paper">
            {showDetails ? "Hide answers" : "Show all answers"}
          </button>
          {showDetails && (
            <dl className="mt-2 grid gap-x-4 gap-y-1 rounded-lg border border-white/10 bg-ink p-3 text-xs sm:grid-cols-[auto_1fr]">
              {details.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-paper-dim">{k.replace(/([A-Z])/g, " $1").toLowerCase()}</dt>
                  <dd className="text-paper">{String(v)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {e.meetGreetAt && (
        <div className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-sm">
          <p className="text-emerald-300">Meet &amp; greet: {longWhen(e.meetGreetAt)}</p>
          {e.meetGreetNotes && <p className="mt-0.5 text-paper/70">{e.meetGreetNotes}</p>}
        </div>
      )}

      {e.status === "onboarding" && (
        <ul className="mt-4 grid gap-3 rounded-xl border border-white/10 bg-ink p-4 text-sm">
          <Tick
            done={["pending_submission", "submitted", "active"].includes(progress?.directDebit ?? "")}
            label="Direct Debit"
            detail={progress ? DD_LABEL[progress.directDebit] ?? progress.directDebit : "Loading…"}
          />
          <Tick
            done={!!progress?.accountLinked}
            label="Account"
            detail={progress?.accountLinked ? "Created and linked" : "Not created yet (or not opened the link signed in)"}
          />
          <Tick
            done={!!e.trainingDay && !!e.firstSessionOn}
            label="Training day"
            detail={
              e.trainingDay && e.firstSessionOn
                ? `${cap(e.trainingDay)}s, ${e.trainingCadence === "alternating" ? "every other week" : "every week"} · first session ${new Date(`${e.firstSessionOn}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`
                : "Not set yet"
            }
          />
          <Tick
            done={!!progress && progress.dogs.length > 0 && progress.dogs.every((d) => d.registered)}
            label="Dog registered (health, vet, consent & waiver)"
            detail={
              !progress || progress.dogs.length === 0
                ? "Not yet"
                : progress.dogs.map((d) => `${d.name}: ${d.registered ? "done" : "not yet"}`).join(" · ")
            }
          />
        </ul>
      )}

      {settingDay && (
        <TrainingDayForm
          enquiry={e}
          onCancel={() => setSettingDay(false)}
          onSaved={(p) => {
            onChange(p);
            setSettingDay(false);
            setNote("Training day saved. They'll get reminders to register before the first session.");
          }}
        />
      )}

      {booking ? (
        <BookMeetGreet
          enquiry={e}
          onCancel={() => setBooking(false)}
          onBooked={(p, msg) => {
            onChange(p);
            setBooking(false);
            setNote(msg);
          }}
        />
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {(e.status === "new" || e.status === "meet_greet_booked") && (
            <Button radius="xl" variant={e.status === "meet_greet_booked" ? "secondary" : "primary"} onClick={() => setBooking(true)}>
              {e.meetGreetAt ? "Change meet & greet" : "Book meet & greet"}
            </Button>
          )}
          {(e.status === "new" || e.status === "meet_greet_booked") && (
            <Button
              radius="xl"
              variant={e.status === "meet_greet_booked" ? "primary" : "secondary"}
              disabled={starting}
              onClick={() => void startOnboarding()}
              className="disabled:opacity-60"
            >
              {starting ? "Starting…" : "Start onboarding"}
            </Button>
          )}
          {e.status === "onboarding" && (
            <>
              <Button radius="xl" onClick={() => setSettingDay(true)}>
                {e.trainingDay ? "Change training day" : "Set training day"}
              </Button>
              <Button radius="xl" variant="secondary" onClick={() => void copyJoinLink()} disabled={!e.onboardingToken}>
                Copy join link
              </Button>
              <Button radius="xl" variant="secondary" disabled={starting} onClick={() => void startOnboarding(true)} className="disabled:opacity-60">
                {starting ? "Sending…" : "Re-send link"}
              </Button>
            </>
          )}
          {e.status !== "closed" && e.status !== "onboarding" && (
            <Button radius="xl" variant="ghost" onClick={() => void notAFit()}>
              Not a fit
            </Button>
          )}
          {e.status === "onboarding" && (
            <Button radius="xl" variant="ghost" onClick={() => void move("closed")}>
              Done
            </Button>
          )}
          {e.status === "closed" && (
            <Button radius="xl" variant="ghost" onClick={() => void move("new")}>
              Reopen
            </Button>
          )}
        </div>
      )}
      {note && <p className="mt-3 break-all text-sm text-emerald-300">{note}</p>}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </li>
  );
}

function BookMeetGreet({
  enquiry: e,
  onCancel,
  onBooked,
}: {
  enquiry: Enquiry;
  onCancel: () => void;
  onBooked: (p: Partial<Enquiry>, message: string) => void;
}) {
  const [at, setAt] = useState(toLocalInput(e.meetGreetAt));
  const [notes, setNotes] = useState(e.meetGreetNotes);
  const [emailThem, setEmailThem] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!at) return setError("Choose a date and time.");
    const iso = new Date(at).toISOString();
    setBusy(true);
    setError("");
    try {
      await updateEnquiry(e.id, { status: "meet_greet_booked", meetGreetAt: iso, meetGreetNotes: notes });
      let message = "Meet & greet booked.";
      if (emailThem) {
        const res = await fetch("/api/onboarding/meet-greet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: e.email, name: e.name, whenLabel: longWhen(iso), notes }),
        });
        const json = await res.json().catch(() => ({}));
        message = json.sent
          ? `Meet & greet booked — ${e.name.split(" ")[0]} has been emailed.`
          : "Meet & greet booked. The email didn't send (email isn't set up yet) — let them know yourself.";
      }
      onBooked({ status: "meet_greet_booked", meetGreetAt: iso, meetGreetNotes: notes }, message);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 grid gap-4 rounded-lg border border-white/10 bg-ink p-4">
      <Field label="Date & time" name={`at-${e.id}`} type="datetime-local" required value={at} onChange={setAt} />
      <Field label="Notes (address, parking, what to bring…)" name={`notes-${e.id}`} textarea rows={2} value={notes} onChange={setNotes} />
      <label className="flex items-center gap-3 text-sm text-paper/85">
        <input type="checkbox" checked={emailThem} onChange={(ev) => setEmailThem(ev.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
        Email {e.name.split(" ")[0]} the day and time
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Button radius="xl" onClick={() => void save()} disabled={busy} className="disabled:opacity-60">
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button radius="xl" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

/**
 * Their regular Full Day Training day (usually repeats weekly or every
 * other week) and first session. Agreed with them directly; this just
 * records it. Owners without a registered dog get reminders before the
 * first session (/api/cron/register-reminders).
 */
function TrainingDayForm({
  enquiry: e,
  onCancel,
  onSaved,
}: {
  enquiry: Enquiry;
  onCancel: () => void;
  onSaved: (p: Partial<Enquiry>) => void;
}) {
  const [day, setDay] = useState(e.trainingDay ?? "");
  const [cadence, setCadence] = useState<string>(e.trainingCadence ?? "weekly");
  const [first, setFirst] = useState(e.firstSessionOn ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!day || !first) return setError("Choose the day and the first session date.");
    const firstDay = DAYS[(new Date(`${first}T12:00:00`).getDay() + 6) % 7];
    if (firstDay !== day) return setError(`The first session should be on a ${cap(day)} (that date is a ${cap(firstDay)}).`);
    setBusy(true);
    setError("");
    try {
      await updateEnquiry(e.id, { trainingDay: day, trainingCadence: cadence, firstSessionOn: first });
      onSaved({ trainingDay: day, trainingCadence: cadence as "weekly" | "alternating", firstSessionOn: first });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 grid gap-4 rounded-lg border border-white/10 bg-ink p-4">
      <Field
        label="Training day"
        name={`day-${e.id}`}
        required
        value={day}
        onChange={setDay}
        options={[{ value: "", label: "Choose…" }, ...DAYS.slice(0, 5).map((d) => ({ value: d, label: `${cap(d)}s` }))]}
      />
      <Field
        label="How often"
        name={`cadence-${e.id}`}
        value={cadence}
        onChange={setCadence}
        options={[
          { value: "weekly", label: "Every week" },
          { value: "alternating", label: "Every other week" },
        ]}
      />
      <Field label="First session" name={`first-${e.id}`} type="date" required value={first} onChange={setFirst} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Button radius="xl" onClick={() => void save()} disabled={busy} className="disabled:opacity-60">
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button radius="xl" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
