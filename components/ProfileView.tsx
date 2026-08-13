"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "./ui/Button";
import { CalendarIcon, ReportIcon, ArrowRightIcon, UserIcon } from "./ui/Icons";
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
import { HolidayReminder } from "./profile/HolidayReminder";
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
          {/* Shared account header — the pack's name + a joint photo that
              becomes the account avatar across the community. */}
          <div className="flex flex-col items-center text-center">
            <h1 className="display-heading text-2xl text-paper">
              {accountDisplayName(session)}
            </h1>
            <p className="mt-1 text-sm text-paper/70">Your pack</p>
            <div className="mt-4">
              <AvatarUpload
                value={session.accountPhoto ?? null}
                onSelect={setAccountPhoto}
                size={96}
                label="Joint photo"
              />
            </div>
            <p className="mt-2 text-xs text-paper-dim">
              Tap to upload a joint photo
            </p>
          </div>

          <hr className="my-6 border-t border-white/10" />

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

          <div className="mt-4">
            <h2 className="display-heading text-xl text-paper">{name}</h2>
            {active.breed && (
              <p className="mt-0.5 text-sm text-paper/70">{active.breed}</p>
            )}
          </div>
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

      {/* Report cards + complete-homework — the two things they do each visit. */}
      <div className="mt-4 grid grid-cols-2 gap-3">
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

      {/* Holiday reminder — session-off notice, or a heads-up a week before */}
      <HolidayReminder
        dayId={active.plan?.dayId}
        cadence={active.plan?.cadence}
        dogName={name}
      />

      {/* Weather reminder — only when the session day looks wet/icy/snowy */}
      {weather && (
        <div className="mt-8 flex items-start gap-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
          <span className="text-2xl leading-none" aria-hidden>{weather.emoji}</span>
          <p className="text-sm text-paper/85">
            <span className="font-semibold text-paper">{weather.label}</span> for{" "}
            {sessionLabel || "your next session"} — remember to pack a coat for{" "}
            {name}. {weather.emoji}
          </p>
        </div>
      )}

      {/* Training plan */}
      <div className="mt-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Training plan
        </h2>
        {active.plan ? (
          <div className="rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-accent">
                <CalendarIcon width={22} height={22} />
              </span>
              <div>
                <p className="font-semibold text-paper">
                  {active.plan.service} · {active.plan.day}
                </p>
                {active.plan.note && (
                  <p className="mt-1 text-sm text-paper/70">{active.plan.note}</p>
                )}
              </div>
            </div>
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
            No training day set yet — we&apos;ll confirm this once you&apos;re
            onboarded.
          </div>
        )}
      </div>

      {/* Their latest community post, or a nudge to share their first */}
      <LatestCommunityPost />

      {/* Stats & skills — placeholder */}
      <div className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Stats &amp; skills
        </h2>
        <div className="rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
          <div className="space-y-3">
            {active.skills.map((s) => (
              <div key={s.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-paper/80">{s.label}</span>
                  <span className="text-paper-dim">
                    {s.level}/{s.of}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(s.level / s.of) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-paper-dim">
            Preview · full skills tracking coming soon
          </p>
        </div>
      </div>

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
