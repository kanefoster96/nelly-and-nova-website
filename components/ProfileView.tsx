"use client";

import { useRouter } from "next/navigation";
import { Button } from "./ui/Button";
import { PawIcon, CalendarIcon, ReportIcon } from "./ui/Icons";
import { useSession, signOut } from "@/lib/auth/session";

/**
 * The account profile — centred on the dog. Today it shows the account picture
 * (their dog's photo) and owner. The sections below are placeholders for what
 * Kane wants next: skill levels, the day they train and report cards.
 */
export function ProfileView() {
  const router = useRouter();
  const session = useSession();

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

  return (
    <div>
      {/* Account header — the dog's photo is the account picture. */}
      <div className="flex flex-col items-center text-center">
        <span className="h-28 w-28 overflow-hidden rounded-full ring-2 ring-accent">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={session.dogPhoto}
            alt={session.dogName}
            className="h-full w-full object-cover"
          />
        </span>
        <h1 className="display-heading mt-4 text-3xl text-paper sm:text-4xl">
          {session.dogName}
        </h1>
        <p className="mt-1 text-paper/70">{session.ownerName}&apos;s account</p>
      </div>

      {/* Future: training progress. Placeholder cards for now. */}
      <div className="mt-10 grid gap-4">
        <ProfileCard
          icon={<PawIcon width={22} height={22} />}
          title="Skill levels"
          body="Track engagement, recall, loose lead and more as your dog progresses."
        />
        <ProfileCard
          icon={<CalendarIcon width={22} height={22} />}
          title="Training day"
          body="Your weekly Walk & Train day will show here once your onboarding is confirmed."
        />
        <ProfileCard
          icon={<ReportIcon width={22} height={22} />}
          title="Report cards"
          body="After each session you'll find your dog's report card and homework here."
        />
      </div>

      <div className="mt-10 flex justify-center">
        <Button variant="secondary" radius="xl" onClick={logout}>
          Log out
        </Button>
      </div>
    </div>
  );
}

function ProfileCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-accent">
          {icon}
        </span>
        <div>
          <p className="font-semibold text-paper">{title}</p>
          <p className="mt-1 text-sm text-paper/70">{body}</p>
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-paper-dim">
            Coming soon
          </p>
        </div>
      </div>
    </div>
  );
}
