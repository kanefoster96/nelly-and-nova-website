import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SignupForm } from "@/components/SignupForm";
import { CheckCircleIcon, MessageIcon, ReportIcon, CalendarIcon } from "@/components/ui/Icons";
import { media } from "@/config/media";

export const metadata: Metadata = {
  title: "Create your account",
  robots: { index: false, follow: false },
};

const PERKS = [
  { Icon: MessageIcon, title: "Chat with the team", body: "Message us any time, straight from your account or the app." },
  { Icon: ReportIcon, title: "Report cards & homework", body: "See what your dog learnt each session and how to keep it going at home." },
  { Icon: CalendarIcon, title: "Your sessions in one place", body: "Upcoming sessions, holidays and changes, all in your profile." },
];

export default async function CreateAccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The "request sent / almost done" note only makes sense when arriving from
  // the booking or enquiry form; a direct sign-up starts fresh.
  const sp = await searchParams;
  const fromBooking = Boolean(sp.email || sp.name || sp.dogName);

  return (
    <>
      <Nav />
      <main id="main" className="flex-1 bg-ink">
        {/* Photo header — same treatment as the homepage cards */}
        <section className="relative isolate overflow-hidden pb-28 pt-28 sm:pb-36 sm:pt-36">
          <div aria-hidden="true" className="absolute inset-0 -z-10">
            <Image src={media.oneToOne.hero} alt="" fill priority sizes="100vw" className="object-cover object-center" />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(10,10,10,0.55) 0%, rgba(10,10,10,0.6) 45%, rgba(10,10,10,0.92) 85%, #0a0a0a 100%)",
              }}
            />
          </div>
          <div className="mx-auto max-w-md px-4 text-center sm:px-6">
            {fromBooking && (
              <p className="glass mx-auto mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-paper hover:bg-white/[0.08]">
                <CheckCircleIcon width={18} height={18} />
                Request sent — we&apos;ve got your details.
              </p>
            )}
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-paper/70">
              {fromBooking ? "Almost done" : "Join Nelly & Nova"}
            </p>
            <h1 className="display-heading mt-3 text-4xl uppercase leading-none text-paper sm:text-5xl">
              Create your account
            </h1>
            <p className="mt-4 text-paper/75">
              Track your dog&apos;s training, chat with the team and keep everything in one place.
            </p>
          </div>
        </section>

        {/* The form, on a frosted card that overlaps the photo */}
        <section className="relative -mt-20 px-4 pb-16 sm:-mt-24 sm:px-6">
          <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-ink-soft/80 p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-8">
            <Suspense fallback={null}>
              <SignupForm />
            </Suspense>
          </div>

          <ul className="mx-auto mt-10 grid max-w-md gap-4">
            {PERKS.map(({ Icon, title, body }) => (
              <li key={title} className="flex items-start gap-4">
                <span className="glass flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-paper hover:bg-white/[0.08]">
                  <Icon width={20} height={20} />
                </span>
                <span>
                  <span className="block font-semibold text-paper">{title}</span>
                  <span className="block text-sm text-paper-dim">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <Footer />
    </>
  );
}
