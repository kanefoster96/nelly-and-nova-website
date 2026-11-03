"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type MeetGreet = {
  status: "new" | "meet_greet_booked" | "onboarding";
  service: string | null;
  dogNames: string | null;
  meetGreetAt: string | null;
  meetGreetNotes: string | null;
  joinToken: string | null;
  trainingDay: string | null;
  trainingCadence: "weekly" | "alternating" | null;
  firstSessionOn: string | null;
} | null;

/**
 * Where their free meet & greet request is up to — the Nelly & Nova version of
 * Kanvas's "your free trial" card. Requested → booked (with the day and
 * time) → onboarding (a link to their checklist). Hidden once there's
 * nothing open.
 */
export function MeetGreetCard() {
  const [mg, setMg] = useState<MeetGreet>(null);

  useEffect(() => {
    createClient()
      .rpc("nn_my_meet_greet")
      .then(({ data }) => setMg((data as MeetGreet) ?? null));
  }, []);

  if (!mg) return null;
  const dog = (mg.dogNames ?? "your dog").replace(/, ([^,]*)$/, " & $1");
  const when = mg.meetGreetAt
    ? new Date(mg.meetGreetAt).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="mb-8 rounded-3xl border border-white/10 bg-ink-soft p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-paper/60">Your free meet &amp; greet</p>
      {mg.status === "new" && (
        <>
          <p className="mt-2 text-lg font-semibold text-paper">Request received</p>
          <p className="mt-1 text-sm text-paper/70">
            We&apos;ll be in touch to ask a few questions and book a day to meet {dog}. Message us any time.
          </p>
        </>
      )}
      {mg.status === "meet_greet_booked" && (
        <>
          <p className="mt-2 text-lg font-semibold text-paper">{when ?? "Booked"}</p>
          <p className="mt-1 text-sm text-paper/70">We&apos;re looking forward to meeting {dog}.</p>
          {mg.meetGreetNotes && <p className="mt-2 whitespace-pre-line text-sm text-paper/80">{mg.meetGreetNotes}</p>}
        </>
      )}
      {mg.status === "onboarding" && (
        <>
          <p className="mt-2 text-lg font-semibold text-paper">Let&apos;s get you set up</p>
          <p className="mt-1 text-sm text-paper/70">Set up your Direct Debit and register {dog} before your first session.</p>
          {mg.trainingDay && mg.firstSessionOn && (
            <p className="mt-2 text-sm font-medium text-paper">
              {mg.trainingDay.charAt(0).toUpperCase() + mg.trainingDay.slice(1)}s, {mg.trainingCadence === "alternating" ? "every other week" : "every week"} · first session{" "}
              {new Date(`${mg.firstSessionOn}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          )}
          {mg.joinToken && (
            <Link
              href={`/join/${mg.joinToken}`}
              className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink"
            >
              Continue set-up
            </Link>
          )}
        </>
      )}
      <Link href="/messages" className="glass mt-4 ml-0 inline-flex min-h-[40px] items-center rounded-full px-5 text-sm font-semibold text-paper sm:ml-2">
        Message us
      </Link>
    </div>
  );
}
