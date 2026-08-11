import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { getWeekSchedule } from "@/lib/schedule/data";
import { dayLabel, spacesLeft } from "@/lib/schedule/types";

export const metadata: Metadata = {
  title: "Schedule",
  robots: { index: false, follow: false },
};

export default async function SchedulePage() {
  const week = await getWeekSchedule();

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
              Weekly schedule
            </h1>
            <p className="mt-3 text-paper/75">
              The dogs booked in each day, and the spaces left for new members.
            </p>

            <RequireAdmin>
              <div className="mt-8 space-y-4">
                {week
                  .filter((d) => d.capacity > 0)
                  .map((d) => {
                    const left = spacesLeft(d);
                    return (
                      <div
                        key={d.day}
                        className="rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <h2 className="font-semibold text-paper">
                            {dayLabel(d.day)}
                          </h2>
                          <span
                            className={`text-xs font-medium ${left === 0 ? "text-paper-dim" : "text-accent"}`}
                          >
                            {left === 0 ? "Full" : `${left} space${left > 1 ? "s" : ""} left`}
                            <span className="text-paper-dim">
                              {" "}
                              · {d.dogs.length}/{d.capacity}
                            </span>
                          </span>
                        </div>

                        {d.dogs.length === 0 ? (
                          <p className="mt-3 text-sm text-paper-dim">No dogs yet.</p>
                        ) : (
                          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                            {d.dogs.map((dog) => (
                              <li
                                key={dog.id}
                                className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2.5"
                              >
                                <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-white/15">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={dog.photo} alt="" className="h-full w-full object-cover" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-paper">
                                    {dog.name}
                                  </p>
                                  <p className="truncate text-xs text-paper-dim">
                                    {dog.ownerName}
                                  </p>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                  {dog.status === "held" && (
                                    <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                                      Held
                                    </span>
                                  )}
                                  {dog.cadence === "alternating" && (
                                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-paper-dim">
                                      Alt {dog.weekParity}
                                    </span>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
              </div>
            </RequireAdmin>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
