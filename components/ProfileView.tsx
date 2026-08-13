"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "./ui/Button";
import {
  CalendarIcon,
  ReportIcon,
  ArrowRightIcon,
  UserIcon,
  HelpCircleIcon,
} from "./ui/Icons";
import {
  useSession,
  signOut,
  setActiveDog,
  setAccountPhoto,
  accountDisplayName,
} from "@/lib/auth/session";
import { useUnseenReportCount } from "@/lib/reports/seen";
import { accountDogProfile } from "@/lib/dogs/account";
import { AvatarUpload } from "./ui/AvatarUpload";
import { sampleReportCards } from "@/lib/reports/sample";
import { useOutboxCards } from "@/lib/reports/outbox";
import { useHomeworkProgress } from "@/lib/reports/progress";
import { useHomeworkResets, resetAtFor } from "@/lib/reports/reset";
import { dogCompletion, monthsAgoISO } from "@/lib/reports/completion";
import { nextDateForDay, dayIdFromISO, formatSessionDate } from "@/lib/schedule/sessions";
import { SKILL_PILLARS, pillarProgress } from "@/config/skills";
import { useSkills, learntSet } from "@/lib/skills/store";
import { HolidayReminder } from "./profile/HolidayReminder";
import { HeatReminder } from "./profile/HeatReminder";
import { LatestCommunityPost } from "./profile/LatestCommunityPost";
import { CompleteHomework } from "./profile/CompleteHomework";
import type { DogProfile } from "@/lib/reports/types";
import type { WeatherReminder } from "@/lib/weather/data";

/**
 * The account profile — centred on the dog. Shows their photo, name, age and
 * number of training sessions; a report-card button (badged when a new card is
 * waiting); their training plan (the Walk & Train day they do); a placeholder
 * for stats/skills; and an "Account holder information" button at the bottom
 * for the owner's own details and password.
 */
export function ProfileView({
  profile,
  weather,
  sessionLabel,
  todayISO,
}: {
  profile: DogProfile;
  weather?: WeatherReminder;
  sessionLabel?: string;
  todayISO: string;
}) {
  const session = useSession();
  const unseen = useUnseenReportCount(session?.dogId);
  const outbox = useOutboxCards();
  const progress = useHomeworkProgress();
  const resets = useHomeworkResets();
  const skills = useSkills();
  const router = useRouter();

  // Homework completion over the past 6 months (shown as a header stat). Cards
  // count from the later of any trainer reset or the 6-month cutoff.
  const homeworkPercent = useMemo(() => {
    const byId = new Map<string, (typeof sampleReportCards)[number]>();
    for (const c of [...outbox, ...sampleReportCards]) if (!byId.has(c.id)) byId.set(c.id, c);
    const sixMonthsAgo = monthsAgoISO(todayISO, 6);
    const reset = resetAtFor(resets, session?.dogId);
    const since = [reset, sixMonthsAgo].filter(Boolean).sort().pop();
    return dogCompletion([...byId.values()], progress, session?.dogId, since).percent;
  }, [outbox, progress, resets, session?.dogId, todayISO]);

  function logout() {
    signOut();
    router.push("/");
  }

  if (!session) {
    return (
      <div className="rounded-3xl bg-white/[0.04] p-8 text-center ring-1 ring-white/10">
        <h2 className="display-heading text-2xl text-paper">
          You&apos;re not logged in
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-paper/75">
          Log in to see your dog&apos;s profile and training progress.
        </p>
        <div className="mt-6 flex justify-center">
          <Button href="/login" radius="xl">
            Log in
          </Button>
        </div>
      </div>
    );
  }

  // The account can hold several dogs; show the active one, and offer a switch.
  const active = accountDogProfile(session.dogId, profile);
  const name = session.dogName || active.name;
  const photo = session.dogPhoto || active.photo;
  const dogs = session.dogs ?? [];
  const multiDog = dogs.length > 1;

  // The active dog's next session date (today if it's their training day).
  // Computed client-side from todayISO so it follows the dog switcher.
  const sessionIsToday = active.plan ? dayIdFromISO(todayISO) === active.plan.dayId : false;
  const sessionDate = active.plan
    ? sessionIsToday
      ? todayISO
      : nextDateForDay(todayISO, active.plan.dayId)
    : "";

  const stats = (
    <div className="flex flex-1 items-center justify-around">
      {/* Level isn't wired up yet — placeholder until levels launch. */}
      <Stat label="Level" value="—" />
      <Stat label="Age" value={active.age} />
      <Stat label="Homework" value={`${homeworkPercent}%`} />
    </div>
  );

  return (
    <div>
      {multiDog ? (
        <>
          {/* Shared account header — joint photo left, pack name beside it to
              keep it compact. The photo becomes the account avatar everywhere. */}
          <div className="flex items-center gap-4">
            <AvatarUpload
              value={session.accountPhoto ?? null}
              onSelect={setAccountPhoto}
              size={64}
              label="Add"
            />
            <div className="min-w-0">
              <h1 className="display-heading text-2xl text-paper">
                {accountDisplayName(session)}
              </h1>
              <p className="text-sm text-paper/70">Your pack · tap photo to add</p>
            </div>
          </div>

          <hr className="my-5 border-t border-white/10" />

          {/* Per-dog: name pills to toggle between dogs, stats for the active one. */}
          <div className="flex items-stretch gap-4">
            <div className="flex w-32 shrink-0 flex-col gap-2">
              {dogs.map((d) => {
                const isActive = d.id === session.dogId;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setActiveDog(d.id)}
                    aria-pressed={isActive}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors ${
                      isActive
                        ? "bg-accent text-accent-ink"
                        : "bg-white/[0.04] text-paper hover:bg-white/[0.08]"
                    }`}
                  >
                    <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.photo} alt="" className="h-full w-full object-cover" />
                    </span>
                    <span className="truncate text-sm font-semibold">{d.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-1 items-center rounded-2xl bg-white/[0.04] px-1 ring-1 ring-white/10">
              {stats}
            </div>
          </div>
          {/* No name/breed here — the pack name is at the top and the selected
              dog is shown on the toggle. */}
        </>
      ) : (
        <>
          {/* Single dog — Instagram-style: photo left, stats right. */}
          <div className="flex items-center gap-6">
            <span className="h-20 w-20 shrink-0 overflow-hidden rounded-full sm:h-24 sm:w-24">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt={name} className="h-full w-full object-cover" />
            </span>
            {stats}
          </div>

          <div className="mt-4">
            <h1 className="display-heading text-2xl text-paper">{name}</h1>
            {active.breed && (
              <p className="mt-0.5 text-sm text-paper/70">{active.breed}</p>
            )}
          </div>
        </>
      )}

      {/* Stats & skills — three pillars, each showing how many skills the dog
          has learnt out of the total. The trainer sets these; owners see the
          level only. */}
      <div className="mt-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Stats &amp; skills
        </h2>
        <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
          <div className="space-y-2.5">
            {SKILL_PILLARS.map((pillar) => {
              const { learnt, total } = pillarProgress(
                pillar,
                learntSet(skills, session.dogId)
              );
              return (
                <PillarStat
                  key={pillar.id}
                  name={pillar.name}
                  blurb={pillar.blurb}
                  pct={total ? (learnt / total) * 100 : 0}
                />
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-paper-dim">
            Assessed and marked off by your trainer.
          </p>
        </div>
      </div>

      {/* Report cards + complete-homework — the two things they do each visit. */}
      <div className="mt-8 grid grid-cols-2 gap-3">
        <Link
          href="/profile/reports"
          className="relative flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-semibold leading-tight text-accent-ink transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ReportIcon width={18} height={18} className="shrink-0" />
          Report cards
          {unseen > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
              {unseen}
            </span>
          )}
        </Link>
        <CompleteHomework dogId={session.dogId} todayISO={todayISO} />
      </div>

      {/* Your next session — type + day, any notices (holiday/weather), then
          rescheduling / booking extra sessions. */}
      <div className="mt-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Your next session
        </h2>
        {active.plan ? (
          <div className="rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
            {/* Session type, with the date of the next session underneath. */}
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-accent">
                <CalendarIcon width={22} height={22} />
              </span>
              <div>
                <p className="font-semibold text-paper">{active.plan.service}</p>
                <p className="text-sm text-paper/70">
                  {sessionIsToday ? "Today · " : ""}
                  {sessionDate ? formatSessionDate(sessionDate) : active.plan.day}
                </p>
                {active.plan.note && (
                  <p className="mt-1 text-xs text-paper-dim">{active.plan.note}</p>
                )}
              </div>
            </div>

            {/* Important notices — heat-day time change (bold), closure, weather. */}
            <HeatReminder sessionDate={sessionDate} />
            <HolidayReminder
              dayId={active.plan?.dayId}
              cadence={active.plan?.cadence}
              dogName={name}
            />
            {weather && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-sky-500/10 p-4 ring-1 ring-sky-400/25">
                <span className="text-2xl leading-none" aria-hidden>{weather.emoji}</span>
                <p className="text-sm text-paper/85">
                  <span className="font-semibold text-sky-200">{weather.label}</span> for{" "}
                  {sessionLabel || "your next session"} — remember to pack a coat for{" "}
                  {name}. {weather.emoji}
                </p>
              </div>
            )}

            {/* Reschedule or book an extra session. */}
            <Link
              href="/profile/sessions"
              className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-white/15 bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/35"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-paper">Upcoming sessions</span>
                <span className="block text-xs text-paper-dim">
                  Reschedule or book an extra session
                </span>
              </span>
              <ArrowRightIcon width={16} height={16} className="shrink-0 text-paper-dim" />
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/[0.04] p-5 text-sm text-paper/70 ring-1 ring-white/10">
            No session day set yet — we&apos;ll confirm this once you&apos;re
            onboarded.
          </div>
        )}
      </div>

      {/* Their latest community post, or a nudge to share their first */}
      <LatestCommunityPost />

      {/* Account holder information — the overall account manager. */}
      <div className="mt-10">
        <Link
          href="/profile/account"
          className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.02] px-4 py-4 transition-colors hover:border-white/35"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-paper">
            <UserIcon width={20} height={20} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-paper">
              Account holder information
            </span>
            <span className="block text-sm text-paper-dim">
              Your details, contact info and password
            </span>
          </span>
          <ArrowRightIcon width={18} height={18} className="ml-auto text-paper-dim" />
        </Link>
      </div>

      {/* Log out */}
      <div className="mt-4 flex justify-center">
        <Button variant="ghost" radius="xl" onClick={logout}>
          Log out
        </Button>
      </div>
    </div>
  );
}

/**
 * One skill pillar — name + a thin progress line. An info icon reveals what the
 * pillar is based on, keeping the row compact. No numeric score is shown.
 */
function PillarStat({ name, blurb, pct }: { name: string; blurb: string; pct: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-paper">{name}</span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={`What is ${name} based on?`}
          aria-expanded={open}
          className="text-paper-dim transition-colors hover:text-paper"
        >
          <HelpCircleIcon width={14} height={14} />
        </button>
      </div>
      {open && <p className="mt-0.5 text-xs text-paper-dim">{blurb}</p>}
      <div className="mt-1 h-1 rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** One stat column in the Instagram-style header — word above, number below. */
function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-paper-dim">
        {label}
      </span>
      <span className="text-lg font-bold text-paper sm:text-xl">{value}</span>
    </div>
  );
}
