import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { CheckIcon, ArrowRightIcon } from "@/components/ui/Icons";
import { createClient } from "@/lib/supabase/server";
import { refreshFromBillingRequest } from "@/lib/gocardless/record";

export const metadata: Metadata = {
  title: "Get set up",
  robots: { index: false, follow: false },
};

type Status = {
  firstName: string;
  name: string;
  email: string;
  dogNames: string | null;
  accountLinked: boolean;
  linkedToYou: boolean;
  directDebit: string;
  billingRequestId: string | null;
  dogs: { id: string; name: string; registered: boolean }[];
} | null;

const DD_DONE = ["pending_submission", "submitted", "active"];
const DD_BAD = ["failed", "cancelled", "expired", "blocked", "consumed", "suspended_by_payer"];

/**
 * The owner's onboarding checklist, sent after the meet & greet (Start
 * onboarding). Three steps, like Kanvas Academy's join → register flow:
 *   1. Direct Debit with GoCardless (their secure page)
 *   2. Account (create one or log in — the link ties itself to it)
 *   3. Register each dog: the consent & waiver form (health, vet, signature)
 * The link itself is the key: no log-in needed to see it or set up the
 * Direct Debit.
 */
export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const load = async () => (await supabase.rpc("nn_onboarding_status", { p_token: token })).data as Status;
  let status = await load();

  if (status) {
    // Back from GoCardless: check with them now rather than waiting for the webhook.
    if (sp.dd === "done" && status.billingRequestId && !DD_DONE.includes(status.directDebit)) {
      await refreshFromBillingRequest(status.billingRequestId);
    }
    // Signed in: tie this onboarding (and its Direct Debit) to their account.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && !status.accountLinked) await supabase.rpc("nn_onboarding_claim", { p_token: token });
    status = await load();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!status) {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="display-heading text-3xl uppercase text-paper">This link isn&apos;t working</h1>
          <p className="mx-auto mt-4 max-w-md text-paper/70">
            It may have expired or already been used. Send us a message and we&apos;ll get you a new one.
          </p>
          <Link href="/contact" className="mt-8 inline-flex min-h-[44px] items-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink">
            Contact us
          </Link>
        </div>
      </Shell>
    );
  }

  const here = `/join/${token}`;
  const ddDone = DD_DONE.includes(status.directDebit);
  const ddBad = DD_BAD.includes(status.directDebit);
  const signedIn = Boolean(user);
  const linked = status.linkedToYou;
  // Signed in, but this onboarding is already tied to someone else's account.
  const otherAccount = signedIn && status.accountLinked && !status.linkedToYou;
  const dogs = status.dogs ?? [];
  const allRegistered = dogs.length > 0 && dogs.every((d) => d.registered);
  const dogLabel = (status.dogNames ?? "your dog").replace(/, ([^,]*)$/, " & $1");
  const everythingDone = ddDone && linked && allRegistered;

  const ddLabel =
    status.directDebit === "active"
      ? "Your Direct Debit is active."
      : ddDone
        ? "Done — your bank is confirming it (this takes a few working days)."
        : ddBad
          ? "That didn't go through. Send us a message and we'll sort out a new link."
          : "On GoCardless's secure page — we never see your bank details. Nothing is taken now: we'll confirm your price and dates with you first.";

  return (
    <Shell>
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-paper/60">Welcome to Nelly &amp; Nova</p>
        <h1 className="display-heading mt-3 text-4xl uppercase leading-none text-paper sm:text-5xl">
          {everythingDone ? "You're all set" : "Let's get you set up"}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-paper/70">
          {everythingDone
            ? `Thanks ${status.firstName}! We'll confirm ${dogLabel}'s training day with you and see you soon.`
            : `Hi ${status.firstName}! Three quick steps before ${dogLabel}'s first session — you can stop and come back to this page any time.`}
        </p>
      </div>

      {sp.dd === "error" && (
        <p className="mt-8 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          We couldn&apos;t open GoCardless just now. Please try again in a moment.
        </p>
      )}

      <ol className="mt-10 grid gap-4">
        {/* 1 — Direct Debit */}
        <Step n={1} title="Set up your Direct Debit" done={ddDone} body={ddLabel}>
          {!ddDone && !ddBad && (
            <a
              href={`${here}/direct-debit`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
            >
              Set up Direct Debit
              <ArrowRightIcon width={16} height={16} />
            </a>
          )}
          {ddBad && (
            <Link href="/messages" className="glass inline-flex min-h-[44px] items-center rounded-full px-6 text-sm font-semibold text-paper">
              Message us
            </Link>
          )}
        </Step>

        {/* 2 — Account */}
        <Step
          n={2}
          title={linked ? "Your account" : "Create your account"}
          done={linked}
          body={
            linked
              ? "Signed in — this is saved to your account."
              : otherAccount
                ? "This link belongs to a different account. Log out and log in with the email we have for you."
                : "So you can see report cards, message us and keep everything in one place."
          }
        >
          {!signedIn && (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/create-account?${new URLSearchParams({ name: status.firstName, lastName: status.name.split(" ").slice(1).join(" "), email: status.email, next: here })}`}
                className={`inline-flex min-h-[44px] items-center rounded-full px-6 text-sm font-semibold ${ddDone ? "bg-accent text-accent-ink" : "glass text-paper"}`}
              >
                Create account
              </Link>
              <Link href={`/login?next=${encodeURIComponent(here)}`} className="glass inline-flex min-h-[44px] items-center rounded-full px-6 text-sm font-semibold text-paper">
                I already have one
              </Link>
            </div>
          )}
        </Step>

        {/* 3 — Register each dog */}
        <Step
          n={3}
          title={`Register ${dogLabel}`}
          done={allRegistered}
          locked={!linked}
          body={
            !linked
              ? "Once you're signed in: their health and vet details, emergency contacts, and the consent & waiver. We can't collect them for their first session until this is done."
              : "Their health and vet details, emergency contacts, and the consent & waiver. We can't collect them for their first session until this is done."
          }
        >
          {linked && (
            <div className="grid gap-2">
              {dogs.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/10">
                  <span className="font-semibold text-paper">{d.name}</span>
                  {d.registered ? (
                    <span className="flex items-center gap-1.5 text-sm text-emerald-300">
                      <CheckIcon width={16} height={16} /> Registered
                    </span>
                  ) : (
                    <Link
                      href={`/waiver?${new URLSearchParams({ dog: d.id, next: here })}`}
                      className="inline-flex min-h-[40px] items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink"
                    >
                      Register
                    </Link>
                  )}
                </div>
              ))}
              {dogs.length === 0 && (
                <Link
                  href={`/waiver?${new URLSearchParams({ next: here })}`}
                  className="inline-flex min-h-[44px] items-center self-start rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink"
                >
                  Register your dog
                </Link>
              )}
            </div>
          )}
        </Step>
      </ol>

      <p className="mt-10 text-center text-sm text-paper-dim">
        Questions?{" "}
        <Link href="/messages" className="text-paper underline underline-offset-2">
          Message us
        </Link>{" "}
        or call 0191 468 3251.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1 bg-ink">
        <section className="mx-auto max-w-xl px-4 pb-24 pt-28 sm:px-6 sm:pt-36">{children}</section>
      </main>
      <Footer />
    </>
  );
}

function Step({
  n,
  title,
  body,
  done,
  locked = false,
  children,
}: {
  n: number;
  title: string;
  body: string;
  done: boolean;
  locked?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li
      className={`rounded-3xl border p-5 sm:p-6 ${done ? "border-emerald-400/20 bg-emerald-400/[0.04]" : "border-white/10 bg-ink-soft"} ${locked ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-4">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            done ? "bg-emerald-400 text-ink" : "bg-white/10 text-paper"
          }`}
        >
          {done ? <CheckIcon width={18} height={18} /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-paper">{title}</h2>
          <p className="mt-1 text-sm text-paper/70">{body}</p>
          {children && !done && <div className="mt-4">{children}</div>}
        </div>
      </div>
    </li>
  );
}
