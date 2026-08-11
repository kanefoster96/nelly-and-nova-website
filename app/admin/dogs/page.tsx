import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { getWeekSchedule } from "@/lib/schedule/data";
import { dayLabel } from "@/lib/schedule/types";
import type { DayId } from "@/lib/schedule/types";

export const metadata: Metadata = {
  title: "All dogs",
  robots: { index: false, follow: false },
};

export default async function DogsPage() {
  const week = await getWeekSchedule();
  // One row per dog, with the day they train.
  const dogs = week.flatMap((d) =>
    d.dogs.map((dog) => ({ ...dog, day: d.day as DayId }))
  );

  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <section className="bg-ink pb-24 pt-28 sm:pt-32">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <Link
              href="/admin"
              className="text-sm text-paper-dim underline underline-offset-2 hover:text-accent"
            >
              ← Back to dashboard
            </Link>
            <h1 className="display-heading mt-4 text-3xl text-paper sm:text-4xl">
              All dogs
            </h1>
            <p className="mt-3 text-paper/75">
              Every dog on the books. Editing profile details is coming next.
            </p>

            <RequireAdmin>
              <ul className="mt-8 space-y-2">
                {dogs.map((dog) => (
                  <li
                    key={dog.id}
                    className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10"
                  >
                    <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full ring-1 ring-white/15">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={dog.photo} alt="" className="h-full w-full object-cover" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-paper">{dog.name}</p>
                      <p className="truncate text-xs text-paper-dim">
                        {dog.ownerName} · {dayLabel(dog.day)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-paper-dim">
                      Edit soon
                    </span>
                  </li>
                ))}
              </ul>
            </RequireAdmin>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
